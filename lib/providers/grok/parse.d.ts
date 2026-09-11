/** Grok escalation-review output parser. */
import type { ApprovalReviewDecision } from '../../auto-review.js';
export type GrokApprovalDecision = ApprovalReviewDecision & {
    readonly decision: 'allow' | 'deny';
};
/** Parse a strict allow/deny object, tolerating one prose wrapper. */
export declare function parseGrokApprovalReview(raw: string): GrokApprovalDecision | undefined;
