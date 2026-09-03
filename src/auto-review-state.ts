import type { ApprovalReviewRouter, ApprovalReviewSessionEvent, ReviewerId } from './auto-review.js'
import type { AutoReviewDefaultStore } from './auto-review-default.js'
import { inheritedSessionSetting } from './session-settings.js'

/** One currently usable reviewer advertised to the client. */
export interface AutoReviewOption {
  readonly reviewer: ReviewerId
  readonly label: string
}

/** Session/global selection plus the options that are usable at read time. */
export interface AutoReviewState {
  readonly reviewer: ReviewerId
  readonly reviewers: readonly AutoReviewOption[]
}

/** Small session shape used at the synchronous session-publication boundary. */
export interface AutoReviewSessionLike {
  readonly id: string
  readonly header?: {
    readonly parentSession?: string
    readonly origin?: string
  }
  readonly events: readonly AutoReviewSessionEventLike[]
  append(type: string, data: Record<string, unknown>): unknown
}

/** The event fields needed to inspect a delegated session's approval policy. */
export interface AutoReviewSessionEventLike {
  readonly type: string
  readonly data?: Record<string, unknown>
}

/** Narrow prompt shape used to replace delegated denial context in place. */
export interface AutoReviewPromptAssemblyLike {
  readonly contexts: Array<{ name: string; text: string }>
}

export interface AutoReviewPromptContextLike {
  readonly agent?: {
    readonly id: string
    readonly session?: AutoReviewSessionLike
  }
}

/** The state operations shared by the host RPC and the plugin composition. */
export interface AutoReviewController {
  autoReview(sessionId: string): Promise<AutoReviewState>
  setAutoReview(sessionId: string, reviewer: ReviewerId): Promise<boolean>
  autoReviewDefault(): Promise<AutoReviewState>
  setAutoReviewDefault(reviewer: ReviewerId): Promise<AutoReviewState | undefined>
}

const DELEGATION_CONTEXT = 'subagent:delegation'
const MACHINE_DELEGATION_CONTEXT = 'Automatic approval review is enabled for this delegated subagent. Operations that require '
  + 'approval may request it through the configured reviewer; no human prompt is available, and a denied or '
  + 'unavailable review remains denied.'

/**
 * In-memory per-session overrides and durable global default composition.
 * Dynamic route availability is intentionally consulted only for offered
 * options and new writes; configured selections remain visible and fail closed.
 */
export class AutoReviewStateStore implements AutoReviewController {
  private readonly sessionReviewers = new Map<string, ReviewerId>()

  constructor(
    private readonly router: ApprovalReviewRouter,
    private readonly defaults: AutoReviewDefaultStore,
    private readonly parentOf: (sessionId: string) => string | undefined,
  ) {}

  /** Resolve the effective configured selection without probing route availability. */
  selectedReviewer(sessionId: string): ReviewerId {
    return inheritedSessionSetting(this.sessionReviewers, sessionId, this.parentOf)
      ?? this.defaults.currentValue()
  }

  /** Resolve the selected route for the approval gate (`none` means no reviewer). */
  async reviewerFor(sessionId: string): Promise<ReviewerId | undefined> {
    const selected = await this.selectedReviewerAsync(sessionId)
    return selected === 'none' ? undefined : selected
  }

  async autoReview(sessionId: string): Promise<AutoReviewState> {
    const reviewers = await this.router.availableOptions()
    return { reviewer: await this.selectedReviewerAsync(sessionId), reviewers }
  }

  async setAutoReview(sessionId: string, reviewer: ReviewerId): Promise<boolean> {
    const options = await this.router.availableOptions()
    if (reviewer !== 'none' && !options.some(option => option.reviewer === reviewer)) return false

    // Remove first so setting the effective inherited/default value does not
    // create a redundant override. A deliberate `none` still overrides a
    // machine-enabled parent/default and is therefore retained.
    this.sessionReviewers.delete(sessionId)
    if (reviewer !== this.selectedReviewer(sessionId)) this.sessionReviewers.set(sessionId, reviewer)
    return true
  }

  async autoReviewDefault(): Promise<AutoReviewState> {
    const reviewers = await this.router.availableOptions()
    return { reviewer: await this.defaults.get(), reviewers }
  }

  async setAutoReviewDefault(reviewer: ReviewerId): Promise<AutoReviewState | undefined> {
    const reviewers = await this.router.availableOptions()
    if (reviewer !== 'none' && !reviewers.some(option => option.reviewer === reviewer)) return undefined
    await this.defaults.set(reviewer)
    return { reviewer: await this.defaults.get(), reviewers }
  }

  /** Whether a selection identifies a configured machine reviewer, regardless of availability. */
  hasConfiguredReviewer(reviewer: ReviewerId): boolean {
    return this.router.hasConfiguredReviewer(reviewer)
  }

  /**
   * Snapshot the parent's effective selection before a delegated session is
   * published. This callback is synchronous by design: the child policy must
   * be committed before its first prompt can assemble.
   */
  onSessionCreated(session: AutoReviewSessionLike): void {
    if (session.header?.origin !== 'subagent' || session.header.parentSession === undefined) return
    const reviewer = this.selectedReviewer(String(session.header.parentSession))
    this.sessionReviewers.set(String(session.id), reviewer)
    const policy = this.hasConfiguredReviewer(reviewer) ? 'ask' : 'never'
    if (this.lastPolicy(session) !== policy) session.append('approval/policy', { policy, source: 'delegation' })
  }

  /** Replace only the delegated denial statement when this child has a machine reviewer selected. */
  onSystemPromptAssemble(
    assembly: AutoReviewPromptAssemblyLike,
    context: AutoReviewPromptContextLike,
  ): AutoReviewPromptAssemblyLike {
    const agent = context.agent
    if (agent === undefined) return assembly
    const session = agent.session
    if (session?.header?.origin !== 'subagent') return assembly
    const reviewer = this.sessionReviewers.get(String(agent.id))
    if (reviewer === undefined || !this.hasConfiguredReviewer(reviewer)) return assembly
    const delegation = assembly.contexts.find(entry => entry.name === DELEGATION_CONTEXT)
    if (delegation !== undefined) delegation.text = MACHINE_DELEGATION_CONTEXT
    return assembly
  }

  /** Expose a read-only snapshot for focused tests and diagnostics. */
  sessionOverride(sessionId: string): ReviewerId | undefined {
    return this.sessionReviewers.get(sessionId)
  }

  private async selectedReviewerAsync(sessionId: string): Promise<ReviewerId> {
    // `get()` is intentionally retained for a single source of truth while
    // the synchronous path is used at session publication and router reads.
    return inheritedSessionSetting(this.sessionReviewers, sessionId, this.parentOf)
      ?? await this.defaults.get()
  }

  private lastPolicy(session: AutoReviewSessionLike): 'ask' | 'never' | undefined {
    for (let index = session.events.length - 1; index >= 0; index -= 1) {
      const event = session.events[index]
      if (event?.type !== 'approval/policy') continue
      const policy = event.data?.policy
      if (policy === 'ask' || policy === 'never') return policy
    }
    return undefined
  }
}
