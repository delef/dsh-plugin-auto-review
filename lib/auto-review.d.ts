/** Provider-neutral routing for automatic reviews of native approval requests. */
import type { Context } from '@deepseek-ai/cordis';
import type { PostToolDecision, PreToolDecision, ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools';
import type { ApprovalOutcome } from '@deepseek-ai/dsh-user-approval';
/** Plugin-owned reviewer identifier; no subscription provider union leaks here. */
export type ReviewerId = string;
type DshToolAgent = NonNullable<ToolExecution['agent']>;
/** One exact durable event from the DSH agent session. */
export type ApprovalReviewSessionEvent = DshToolAgent['session']['events'][number];
type ApprovalAskedEvent = Extract<ApprovalReviewSessionEvent, {
    readonly type: 'approval/asked';
}>;
type ApprovalDecidedEvent = Extract<ApprovalReviewSessionEvent, {
    readonly type: 'approval/decided';
}>;
/** The only cancellation capability an automatic reviewer may exercise. */
export type ApprovalReviewCancellation = Extract<Parameters<DshToolAgent['cancel']>[0], {
    readonly kind: 'hook';
}>;
/**
 * Least-privilege view of the live DSH agent shared with reviewer providers.
 * A real DSH Agent satisfies it structurally; reviewers cannot reach unrelated
 * agent state, and test doubles remain fully type-checked without assertions.
 */
export interface ApprovalReviewAgent {
    readonly id: string;
    readonly session: {
        readonly events: readonly ApprovalReviewSessionEvent[];
        readonly header?: {
            readonly origin?: 'subagent';
        };
        readonly surface: {
            readonly nodes: readonly number[];
        };
    };
    cancel(cause: ApprovalReviewCancellation): void;
}
/** Host-only audit capability; provider implementations receive the narrower read-only agent above. */
export interface ApprovalReviewHostAgent extends ApprovalReviewAgent {
    readonly session: ApprovalReviewAgent['session'] & {
        append(type: ApprovalAskedEvent['type'], data: ApprovalAskedEvent['data']): ApprovalAskedEvent;
        append(type: ApprovalDecidedEvent['type'], data: ApprovalDecidedEvent['data']): ApprovalDecidedEvent;
    };
}
/**
 * Least-privilege tool execution retained until the matching approval request.
 * `arguments` intentionally remains `unknown`: that is the upstream DSH
 * ToolExecution contract after registry validation, not an untyped local API.
 */
interface ApprovalExecutionFields {
    readonly name: ToolExecution['name'];
    readonly callId: ToolExecution['callId'];
    readonly arguments: ToolExecution['arguments'];
    readonly agent?: ApprovalReviewHostAgent;
    readonly signal: ToolExecution['signal'];
}
/** Exact tool action captured before the tool asks the native approval service. */
export type ApprovalReviewAction = Pick<ApprovalExecutionFields, 'name' | 'callId' | 'arguments'>;
/** Provider-neutral request passed only after a real native approval prompt exists. */
export interface ApprovalReviewRequest {
    readonly agent: ApprovalReviewAgent;
    readonly action: ApprovalReviewAction;
    readonly reason?: string;
    readonly signal: AbortSignal;
}
/** Closed review result. `ask` is inconclusive and stays denied while a reviewer is selected. */
export interface ApprovalReviewDecision {
    readonly decision: 'allow' | 'deny' | 'ask';
    readonly reason: string;
}
/**
 * One provider-owned automatic reviewer implementation.
 *
 * The provider owns classifier policy, transcript projection, transport,
 * retries, and provider-specific failure semantics. The shared gate routes a
 * real DSH approval request; with a reviewer selected it fail-closes instead
 * of falling through to a human prompt.
 */
export interface ApprovalReviewer {
    readonly reviewerId: ReviewerId;
    /** User-facing provider name used by the selector and review activity. */
    readonly reviewerLabel: string;
    /** Dynamic route/model capability; selection remains fail-closed when false. */
    available?(signal?: AbortSignal): Promise<boolean>;
    reviewApproval(request: ApprovalReviewRequest): Promise<ApprovalReviewDecision | undefined>;
}
/** Routes one real approval request to the reviewer selected for that session. */
export declare class ApprovalReviewRouter {
    private readonly reviewerFor;
    private readonly reviewers;
    constructor(reviewers: Iterable<ApprovalReviewer>, reviewerFor: (agent: ApprovalReviewAgent) => ReviewerId | undefined | Promise<ReviewerId | undefined>);
    review(request: ApprovalReviewRequest, onRouted?: (reviewerId: ReviewerId, reviewerLabel: string) => void): Promise<ApprovalReviewDecision | undefined>;
    /** Whether this agent currently selects one registered machine reviewer. */
    hasReviewer(agent: ApprovalReviewAgent): Promise<boolean>;
    /** Whether a reviewer id belongs to this configured router, independent of availability. */
    hasConfiguredReviewer(reviewerId: ReviewerId): boolean;
    /** Only currently usable reviewers belong in UI/RPC option lists. */
    availableOptions(): Promise<readonly {
        reviewer: ReviewerId;
        label: string;
    }[]>;
    /** Backward-compatible internal name for existing standalone composition. */
    options(): Promise<readonly {
        reviewer: ReviewerId;
        label: string;
    }[]>;
}
export type GatePreToolDecision = PreToolDecision;
export type GateApprovalOutcome = ApprovalOutcome;
export type GateExecution = ApprovalExecutionFields;
interface GateRetryExecution {
    readonly callId: ToolExecution['callId'];
    readonly name: ToolExecution['name'];
    readonly arguments: ToolExecution['arguments'];
    readonly signal: ToolExecution['signal'];
}
export interface GateApprovalRequest {
    readonly agent: ApprovalReviewHostAgent;
    readonly toolName: string;
    readonly callId?: ToolExecution['callId'];
    readonly reason?: string;
    readonly signal?: AbortSignal;
}
/**
 * Bridges the tool lifecycle to the native approval waterfall. Capturing is
 * deliberately model-free: the router is called only by `answerApproval`,
 * after the tool has actually asked the user for permission.
 */
export declare class AutoReviewGate {
    private readonly router;
    private readonly candidates;
    constructor(router: ApprovalReviewRouter);
    preExecute(exec: GateExecution, next: () => Promise<GatePreToolDecision>): Promise<GatePreToolDecision>;
    answerApproval(request: GateApprovalRequest, next: () => Promise<GateApprovalOutcome>): Promise<GateApprovalOutcome>;
    /** Collapse a denied Bash call and its sanctioned escalation into one model-visible call. */
    postExecute(exec: GateExecution, result: Readonly<ToolExecutionResult>, next: () => Promise<PostToolDecision>, retry: (execution: GateRetryExecution) => Promise<ToolExecutionResult>): Promise<PostToolDecision>;
    private remember;
    private consume;
}
/** Mount capture and approval wrappers around one shared reviewer router. */
export declare function installAutoReview(context: Context, router: ApprovalReviewRouter): void;
/** Install the same hooks only after the optional Tools service is available. */
export declare function installAutoReviewWhenToolsAvailable(context: Context, router: ApprovalReviewRouter): void;
export {};
