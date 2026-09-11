import type { ApprovalReviewRouter, ReviewerId } from './auto-review.js';
import type { AutoReviewDefaultStore } from './auto-review-default.js';
/** One currently usable reviewer advertised to the client. */
export interface AutoReviewOption {
    readonly reviewer: ReviewerId;
    readonly label: string;
}
/** Session/global selection plus the options that are usable at read time. */
export interface AutoReviewState {
    readonly reviewer: ReviewerId;
    readonly reviewers: readonly AutoReviewOption[];
}
/** Small session shape used at the synchronous session-publication boundary. */
export interface AutoReviewSessionLike {
    readonly id: string;
    readonly header?: {
        readonly parentSession?: string;
        readonly origin?: string;
    };
    readonly events: readonly AutoReviewSessionEventLike[];
    append(type: string, data: Record<string, unknown>): unknown;
}
/** The event fields needed to inspect a delegated session's approval policy. */
export interface AutoReviewSessionEventLike {
    readonly type: string;
    readonly data?: Record<string, unknown>;
}
/** Narrow prompt shape used to replace delegated denial context in place. */
export interface AutoReviewPromptAssemblyLike {
    readonly contexts: Array<{
        name: string;
        text: string;
    }>;
}
export interface AutoReviewPromptContextLike {
    readonly agent?: {
        readonly id: string;
        readonly session?: AutoReviewSessionLike;
    };
}
/** The state operations shared by the host RPC and the plugin composition. */
export interface AutoReviewController {
    autoReview(sessionId: string): Promise<AutoReviewState>;
    setAutoReview(sessionId: string, reviewer: ReviewerId): Promise<boolean>;
    autoReviewDefault(): Promise<AutoReviewState>;
    setAutoReviewDefault(reviewer: ReviewerId): Promise<AutoReviewState | undefined>;
}
/**
 * In-memory per-session overrides and durable global default composition.
 * Dynamic route availability is intentionally consulted only for offered
 * options and new writes; configured selections remain visible and fail closed.
 */
export declare class AutoReviewStateStore implements AutoReviewController {
    private readonly router;
    private readonly defaults;
    private readonly parentOf;
    private readonly sessionReviewers;
    constructor(router: ApprovalReviewRouter, defaults: AutoReviewDefaultStore, parentOf: (sessionId: string) => string | undefined);
    /** Resolve the effective configured selection without probing route availability. */
    selectedReviewer(sessionId: string): ReviewerId;
    /** Resolve the selected route for the approval gate (`none` means no reviewer). */
    reviewerFor(sessionId: string): Promise<ReviewerId | undefined>;
    autoReview(sessionId: string): Promise<AutoReviewState>;
    setAutoReview(sessionId: string, reviewer: ReviewerId): Promise<boolean>;
    autoReviewDefault(): Promise<AutoReviewState>;
    setAutoReviewDefault(reviewer: ReviewerId): Promise<AutoReviewState | undefined>;
    /** Whether a selection identifies a configured machine reviewer, regardless of availability. */
    hasConfiguredReviewer(reviewer: ReviewerId): boolean;
    /**
     * Snapshot the parent's effective selection before a delegated session is
     * published. This callback is synchronous by design: the child policy must
     * be committed before its first prompt can assemble.
     */
    onSessionCreated(session: AutoReviewSessionLike): void;
    /** Replace only the delegated denial statement when this child has a machine reviewer selected. */
    onSystemPromptAssemble(assembly: AutoReviewPromptAssemblyLike, context: AutoReviewPromptContextLike): AutoReviewPromptAssemblyLike;
    /** Expose a read-only snapshot for focused tests and diagnostics. */
    sessionOverride(sessionId: string): ReviewerId | undefined;
    private selectedReviewerAsync;
    private lastPolicy;
}
