/** Grok escalation reviewer over a configured generic DSH LLM route. */

import {
  BlockAssembler,
  createAssistantMessage,
  createUserMessage,
  type GenerateOptions,
  type Message,
} from '@deepseek-ai/dsh-llm'
import type { Context } from '@deepseek-ai/cordis'
import type {
  ApprovalReviewCancellation,
  ApprovalReviewDecision,
  ApprovalReviewRequest,
  ApprovalReviewer,
} from '../../auto-review.js'
import { GROK_ESCALATION_POLICY } from './policy.js'
import {
  actionCommand,
  bounded,
  grokReviewPrompt,
  hardDeniedCommand,
} from './prompt.js'
import { parseGrokApprovalReview, type GrokApprovalDecision } from './parse.js'

const GROK_REVIEW_TIMEOUT_MS = 90_000
const GROK_REVIEW_MAX_ATTEMPTS = 3
const GROK_REVIEW_MAX_OUTPUT_TOKENS = 2_048
const GROK_REVIEW_MAX_CONSECUTIVE_DENIALS = 3
const GROK_REVIEW_RETRY_INITIAL_DELAY_MS = 250
const GROK_REVIEW_HISTORY_MAX_MESSAGES = 16
const GROK_REVIEW_ASSISTANT_RESPONSE_BYTES = 4_096

export interface GrokConfig {
  reviewerId: string
  label: string
  /** Explicit discriminator used by the standalone route factory. */
  policy?: 'grok'
  provider: string
  model: string
  reasoningEffort?: string
}

export interface GrokApprovalReviewSession {
  readonly messages: Message[]
  surfaceNodes: number[]
  tail: Promise<void>
  denialTurnId?: string
  consecutiveDenials: number
  interruptionScheduled: boolean
}

function approvalTurnId(agent: ApprovalReviewRequest['agent']): string {
  for (let index = agent.session.events.length - 1; index >= 0; index -= 1) {
    const event = agent.session.events[index]
    if (event?.type === 'turn/start') return String(event.data.turn)
  }
  return '<unknown-turn>'
}

async function waitForGrokReviewRetry(attempt: number, signal: AbortSignal): Promise<void> {
  const delayMs = GROK_REVIEW_RETRY_INITIAL_DELAY_MS * (2 ** (attempt - 1))
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, delayMs)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'))
    }
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/** Grok's bounded approval policy over any configured DSH route. */
export class GrokReviewer implements ApprovalReviewer {
  readonly reviewerId: string
  readonly reviewerLabel: string
  private readonly approvalReviewSessions = new WeakMap<ApprovalReviewRequest['agent'], GrokApprovalReviewSession>()

  constructor(private readonly ctx: Context, private readonly config: GrokConfig) {
    this.reviewerId = config.reviewerId
    this.reviewerLabel = config.label
  }

  /** Route and model capability are checked independently of selected state. */
  async available(signal?: AbortSignal): Promise<boolean> {
    try {
      if (!this.ctx.llm.listProviders().some(provider => provider.id === this.config.provider)) return false
      if (signal?.aborted) return false
      const modelInfo = this.ctx.llm.resolveModelInfo(this.config.provider, this.config.model, signal)
      if (signal === undefined) return Boolean(await modelInfo)
      let onAbort: (() => void) | undefined
      const aborted = new Promise<undefined>(resolve => {
        onAbort = () => resolve(undefined)
        if (signal.aborted) onAbort()
        else signal.addEventListener('abort', onAbort, { once: true })
      })
      try {
        return Boolean(await Promise.race([modelInfo, aborted]))
      } finally {
        if (onAbort !== undefined) signal.removeEventListener('abort', onAbort)
      }
    } catch {
      return false
    }
  }

  /** Serialize one review stream per agent while reusing its transcript state. */
  reviewApproval(request: ApprovalReviewRequest): Promise<ApprovalReviewDecision | undefined> {
    let state = this.approvalReviewSessions.get(request.agent)
    if (state === undefined) {
      state = {
        messages: [],
        surfaceNodes: [],
        tail: Promise.resolve(),
        consecutiveDenials: 0,
        interruptionScheduled: false,
      }
      this.approvalReviewSessions.set(request.agent, state)
    }
    const review = state.tail.then(() => this.runApprovalReview(request, state))
    state.tail = review.then(() => undefined, () => undefined)
    return review
  }

  private async runApprovalReview(
    request: ApprovalReviewRequest,
    state: GrokApprovalReviewSession,
  ): Promise<ApprovalReviewDecision | undefined> {
    const command = actionCommand(request)
    if (hardDeniedCommand(command)) {
      const denied: GrokApprovalDecision = {
        decision: 'deny',
        reason: 'Hard-denied a known-dangerous command pattern.',
      }
      this.recordApprovalReviewDecision(request, state, denied.decision)
      return denied
    }

    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(GROK_REVIEW_TIMEOUT_MS)])
    if (!await this.available(signal)) return undefined
    const { prompt, nodes } = grokReviewPrompt(request, state)
    const userMessage = createUserMessage({
      source: { kind: 'plugin', plugin: 'dsh-plugin-auto-review' },
      content: [{ type: 'text', text: prompt }],
    })

    for (let attempt = 1; attempt <= GROK_REVIEW_MAX_ATTEMPTS && !signal.aborted; attempt += 1) {
      const assembler = new BlockAssembler()
      try {
        const options: GenerateOptions = {
          provider: this.config.provider,
          model: this.config.model,
          system: GROK_ESCALATION_POLICY,
          messages: [...state.messages, userMessage],
          maxTokens: GROK_REVIEW_MAX_OUTPUT_TOKENS,
          signal,
        }
        if (this.config.reasoningEffort !== undefined) {
          ;(options as { reasoningEffort?: GenerateOptions['reasoningEffort'] }).reasoningEffort = this.config.reasoningEffort as GenerateOptions['reasoningEffort']
        }
        for await (const chunk of this.ctx.llm.stream(options)) assembler.push(chunk)
        if (assembler.finish.kind === 'error' || assembler.finish.kind === 'aborted' || assembler.finish.kind === 'max-tokens') {
          if (attempt < GROK_REVIEW_MAX_ATTEMPTS) await waitForGrokReviewRetry(attempt, signal)
          continue
        }
        const raw = assembler.blocks()
          .filter(block => block.type === 'text')
          .map(block => block.type === 'text' ? block.text : '')
          .join('')
          .trim()
        const decision = parseGrokApprovalReview(raw)
        if (decision === undefined) {
          if (attempt < GROK_REVIEW_MAX_ATTEMPTS) await waitForGrokReviewRetry(attempt, signal)
          continue
        }
        state.messages.push(
          userMessage,
          createAssistantMessage({
            source: { provider: this.config.provider, model: this.config.model },
            content: [{ type: 'text', text: bounded(raw, GROK_REVIEW_ASSISTANT_RESPONSE_BYTES) }],
          }),
        )
        while (state.messages.length > GROK_REVIEW_HISTORY_MAX_MESSAGES) state.messages.splice(0, 2)
        state.surfaceNodes = nodes
        this.recordApprovalReviewDecision(request, state, decision.decision)
        return decision
      } catch {
        if (signal.aborted || attempt === GROK_REVIEW_MAX_ATTEMPTS) continue
        try {
          await waitForGrokReviewRetry(attempt, signal)
        } catch {
          return undefined
        }
      }
    }
    return undefined
  }

  /** Interrupt after three consecutive denials in the same turn. */
  private recordApprovalReviewDecision(
    request: ApprovalReviewRequest,
    state: GrokApprovalReviewSession,
    decision: GrokApprovalDecision['decision'],
  ): void {
    const turnId = approvalTurnId(request.agent)
    if (state.denialTurnId !== turnId) {
      state.denialTurnId = turnId
      state.consecutiveDenials = 0
      state.interruptionScheduled = false
    }
    const denied = decision === 'deny'
    state.consecutiveDenials = denied ? state.consecutiveDenials + 1 : 0
    if (!denied || state.interruptionScheduled || state.consecutiveDenials < GROK_REVIEW_MAX_CONSECUTIVE_DENIALS) return
    state.interruptionScheduled = true
    const cancel = request.agent.cancel
    setTimeout(() => {
      try {
        const cause: ApprovalReviewCancellation = {
          kind: 'hook',
          reason: 'Automatic approval review rejected too many requests in this turn.',
        }
        Reflect.apply(cancel, request.agent, [cause])
      } catch {
        // A disappearing agent must not turn a valid denial into a fallback.
      }
    }, 0)
  }
}
