/** Codex Guardian transcript projection and bounded prompt construction. */
import type { ApprovalReviewRequest } from '../../auto-review.js';
import type { CodexApprovalReviewSession } from './reviewer.js';
export interface CodexTranscriptEntry {
    readonly kind: 'user' | 'assistant' | 'tool';
    readonly ordinal: number;
    readonly text: string;
}
export interface CodexTranscriptSnapshot {
    readonly nodes: number[];
    readonly entries: CodexTranscriptEntry[];
}
export declare function utf8Prefix(text: string, maxBytes: number): string;
export declare function utf8Suffix(text: string, maxBytes: number): string;
/** Preserve both ends without splitting a UTF-8 code point. */
export declare function bounded(text: string, maxBytes: number): string;
/** Project only the live model-visible surface; source tags establish trust. */
export declare function codexTranscriptSnapshot(agent: ApprovalReviewRequest['agent'], startNode?: number): CodexTranscriptSnapshot;
export declare function isNodePrefix(prefix: readonly number[], nodes: readonly number[]): boolean;
export declare function codexReviewPrompt(request: ApprovalReviewRequest, state: CodexApprovalReviewSession): {
    prompt: string;
    nodes: number[];
};
