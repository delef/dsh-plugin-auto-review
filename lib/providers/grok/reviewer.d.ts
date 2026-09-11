/** Grok escalation reviewer over a configured generic DSH LLM route. */
import { type Message } from '@deepseek-ai/dsh-llm';
import type { Context } from '@deepseek-ai/cordis';
import type { ApprovalReviewDecision, ApprovalReviewRequest, ApprovalReviewer } from '../../auto-review.js';
export interface GrokConfig {
    reviewerId: string;
    label: string;
    /** Explicit discriminator used by the standalone route factory. */
    policy?: 'grok';
    provider: string;
    model: string;
    reasoningEffort?: string;
}
export interface GrokApprovalReviewSession {
    readonly messages: Message[];
    surfaceNodes: number[];
    tail: Promise<void>;
    denialTurnId?: string;
    consecutiveDenials: number;
    interruptionScheduled: boolean;
}
/** Grok's bounded approval policy over any configured DSH route. */
export declare class GrokReviewer implements ApprovalReviewer {
    private readonly ctx;
    private readonly config;
    readonly reviewerId: string;
    readonly reviewerLabel: string;
    private readonly approvalReviewSessions;
    constructor(ctx: Context, config: GrokConfig);
    /** Route and model capability are checked independently of selected state. */
    available(signal?: AbortSignal): Promise<boolean>;
    /** Serialize one review stream per agent while reusing its transcript state. */
    reviewApproval(request: ApprovalReviewRequest): Promise<ApprovalReviewDecision | undefined>;
    private runApprovalReview;
    /** Interrupt after three consecutive denials in the same turn. */
    private recordApprovalReviewDecision;
}
