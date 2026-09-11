/** Codex Guardian output parser. */
import type { ApprovalReviewDecision } from '../../auto-review.js';
type CodexApprovalDecision = ApprovalReviewDecision & {
    readonly decision: 'allow' | 'deny';
};
/** Parse one strict Guardian result, tolerating exactly one prose wrapper. */
export declare function parseCodexApprovalReview(raw: string): CodexApprovalDecision | undefined;
export {};
