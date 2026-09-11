/** Codex Guardian reviewer over a configured generic DSH LLM route. */
import { type Message } from '@deepseek-ai/dsh-llm';
import type { Context } from '@deepseek-ai/cordis';
import type { ApprovalReviewDecision, ApprovalReviewRequest, ApprovalReviewer } from '../../auto-review.js';
export interface GuardianConfig {
    reviewerId: string;
    label: string;
    /** Optional route discriminator; omitted values retain Codex behavior. */
    policy?: 'codex';
    provider: string;
    model: string;
    reasoningEffort?: string;
}
export interface CodexApprovalReviewSession {
    readonly messages: Message[];
    surfaceNodes: number[];
    tail: Promise<void>;
    denialTurnId?: string;
    consecutiveDenials: number;
    recentDenials: boolean[];
    interruptionScheduled: boolean;
}
/** Codex Guardian policy over any configured DSH LLM route. */
export declare class CodexGuardianReviewer implements ApprovalReviewer {
    private readonly ctx;
    private readonly config;
    readonly reviewerId: string;
    readonly reviewerLabel: string;
    private readonly approvalReviewSessions;
    constructor(ctx: Context, config: GuardianConfig);
    /** Route and model capability are checked independently of selected state. */
    available(signal?: AbortSignal): Promise<boolean>;
    /** Serialize one review stream per agent while reusing its transcript state. */
    reviewApproval(request: ApprovalReviewRequest): Promise<ApprovalReviewDecision | undefined>;
    private runApprovalReview;
    /** Match Guardian's three-consecutive / ten-of-fifty per-turn breaker. */
    private recordApprovalReviewDecision;
}
