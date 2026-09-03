/** Provider-backed automatic approval review for DeepSeek Harness. */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
// Type-only: activates the Tools and session event extensions used by the
// deferred approval hooks below without creating a runtime dependency.
import type {} from '@deepseek-ai/dsh-tools'
import {
  ApprovalReviewRouter,
  installAutoReview,
} from './auto-review.js'
import { AutoReviewDefaultStore } from './auto-review-default.js'
import {
  AutoReviewStateStore,
  type AutoReviewSessionLike,
  type AutoReviewPromptAssemblyLike,
  type AutoReviewPromptContextLike,
} from './auto-review-state.js'
import { CodexGuardianReviewer, type GuardianConfig } from './providers/codex/index.js'
import { GrokReviewer, type GrokConfig } from './providers/grok/index.js'
import { registerAutoReviewRpc } from './rpc.js'

export type { GuardianConfig } from './providers/codex/index.js'
export type { GrokConfig } from './providers/grok/index.js'

export const name = 'auto-review'
export const inject = ['llm']

/** A provider-specific route selected by its explicit policy discriminator. */
export type ReviewerConfig = (GuardianConfig & { policy?: 'codex' }) | (GrokConfig & { policy: 'grok' })

export interface Config {
  autoReview?: 'none' | string
  reviewers?: ReviewerConfig[]
}

/** Default route shipped by the standalone plugin. */
export const DEFAULT_REVIEWER: GuardianConfig = {
  reviewerId: 'codex',
  label: 'Codex',
  provider: 'codex',
  model: 'codex-auto-review',
  reasoningEffort: 'low',
}

/** Default Grok route; availability is checked dynamically by the router. */
export const DEFAULT_GROK_REVIEWER: GrokConfig = {
  reviewerId: 'grok',
  label: 'Grok',
  policy: 'grok',
  provider: 'grok',
  model: 'grok-4-fast-reasoning',
}

const nonBlankString = (): z<string> => z.string().pattern(/\S+/).required()

const reviewerSchema: z<ReviewerConfig> = z.object({
  reviewerId: nonBlankString(),
  label: nonBlankString(),
  provider: nonBlankString(),
  model: nonBlankString(),
  reasoningEffort: z.string().pattern(/\S+/),
  policy: z.union(['codex', 'grok']),
})

/** Config schema with a usable Codex route when no route list is supplied. */
export const Config: z<Config> = z.object({
  autoReview: z.string().default('none'),
  reviewers: z.array(reviewerSchema).default([DEFAULT_REVIEWER, DEFAULT_GROK_REVIEWER]),
})

function parentSessionOf(context: Context, sessionId: string): string | undefined {
  try {
    const agents = context.get('agents') as {
      get(id: string): { readonly session?: { readonly header?: { readonly parentSession?: string } } } | undefined
    } | undefined
    const parent = agents?.get(sessionId)?.session?.header?.parentSession
    return parent === undefined ? undefined : String(parent)
  } catch {
    // `agents` is optional in minimal/headless compositions.
    return undefined
  }
}

function warnFor(context: Context): (message: string) => void {
  return message => {
    try { context.logger('auto-review').warn(message) } catch { /* optional logger in fixtures */ }
  }
}

/** Compose reviewer routing, state/persistence, optional Tools, and RPC. */
export function apply(context: Context, config: Config): void {
  const normalizedConfig = Config(config)
  const routeConfig = normalizedConfig.reviewers ?? [DEFAULT_REVIEWER, DEFAULT_GROK_REVIEWER]
  const reviewers = routeConfig.map(route => route.policy === 'grok'
    ? new GrokReviewer(context, route)
    : new CodexGuardianReviewer(context, route))
  let state!: AutoReviewStateStore
  const router = new ApprovalReviewRouter(reviewers, agent => state.reviewerFor(String(agent.id)))
  const defaults = new AutoReviewDefaultStore(
    normalizedConfig.autoReview ?? 'none',
    reviewer => router.hasConfiguredReviewer(reviewer),
    warnFor(context),
  )
  state = new AutoReviewStateStore(
    router,
    defaults,
    sessionId => parentSessionOf(context, sessionId),
  )

  // The Tools service is optional. Capture/approval/post-execute hooks are
  // mounted only after it appears; no service absence short-circuits RPC or
  // session/prompt behavior below.
  context.inject(['tools'], toolsContext => installAutoReview(toolsContext, router))
  registerAutoReviewRpc(context, state)

  context.on('session/created', session => {
    state.onSessionCreated(session as unknown as AutoReviewSessionLike)
  }, { global: true })
  context.on('system-prompt/assemble', async (assembly, promptContext, next) => {
    const assembled = await next()
    return state.onSystemPromptAssemble(
      assembled as unknown as AutoReviewPromptAssemblyLike,
      promptContext as unknown as AutoReviewPromptContextLike,
    ) as typeof assembled
  }, { global: true, prepend: true })
}
