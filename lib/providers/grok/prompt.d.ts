/** Grok escalation-review transcript projection and local command safeguards. */
import type { ApprovalReviewAgent, ApprovalReviewRequest } from '../../auto-review.js';
import type { GrokApprovalReviewSession } from './reviewer.js';
export interface GrokTranscriptEntry {
    readonly kind: 'user' | 'tool';
    readonly text: string;
}
export interface GrokTranscriptSnapshot {
    readonly nodes: number[];
    readonly entries: GrokTranscriptEntry[];
}
/** Preserve both ends without splitting a UTF-8 code point. */
export declare function bounded(text: string, maxBytes: number): string;
/** Local pre-model deny for patterns whose intent is unambiguously dangerous. */
export declare function hardDeniedCommand(command: string): boolean;
export declare function actionCommand(request: ApprovalReviewRequest): string;
/** Project direct user turns and assistant tool calls; tool output is never a user anchor. */
export declare function grokTranscriptSnapshot(agent: ApprovalReviewAgent, startNode?: number): GrokTranscriptSnapshot;
export declare function grokReviewPrompt(request: ApprovalReviewRequest, state: GrokApprovalReviewSession): {
    prompt: string;
    nodes: number[];
};
