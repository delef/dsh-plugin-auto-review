import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { type AutoReviewRpc } from './rpc.js';
export type { AutoReviewRpc } from './rpc.js';
/** None preserves DSH's native manual approval flow. */
export type AutoReviewMode = 'none' | string;
/** One route currently usable by the host LLM runtime. */
export interface AutoReviewOption {
    readonly reviewer: string;
    readonly label: string;
}
/** Value returned by the host `autoReview` endpoint. */
export interface AutoReviewState {
    readonly reviewer: AutoReviewMode;
    readonly reviewers: readonly AutoReviewOption[];
}
/** Session-bound callbacks injected by the client slot registration. */
export interface AutoReviewSelectInjected {
    loadAutoReview: () => Promise<AutoReviewState>;
    setAutoReview: (reviewer: AutoReviewMode) => Promise<boolean>;
}
export type AutoReviewSelectProps = PropsRuntime<'conversation.input.right'> & Partial<AutoReviewSelectInjected> & Partial<PropsLocale<'settings.autoReview'>>;
/** Bind the per-session read endpoint to one Connection RPC face. */
export declare function createAutoReviewLoader(rpc: AutoReviewRpc, sessionId: string): AutoReviewSelectInjected['loadAutoReview'];
/** Bind the per-session write endpoint and reduce business errors to `false`. */
export declare function createAutoReviewSetter(rpc: AutoReviewRpc, sessionId: string): AutoReviewSelectInjected['setAutoReview'];
/** Render a compact menu beside other composer controls. */
export declare function AutoReviewSelect({ loadAutoReview, setAutoReview, t }: AutoReviewSelectProps): import("react").JSX.Element | null;
