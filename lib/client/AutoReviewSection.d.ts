import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { type AutoReviewRpc } from './rpc.js';
import type { AutoReviewState } from './AutoReviewSelect.js';
export interface AutoReviewSectionInjected {
    loadAutoReviewDefault: () => Promise<AutoReviewState>;
    setAutoReviewDefault: (reviewer: string) => Promise<AutoReviewState>;
}
export type AutoReviewSectionProps = PropsRuntime<'settings.section'> & Partial<AutoReviewSectionInjected> & Partial<PropsLocale<'settings.autoReview'>>;
/** Bind the Settings read endpoint to one Connection RPC face. */
export declare function createAutoReviewDefaultLoader(rpc: AutoReviewRpc): AutoReviewSectionInjected['loadAutoReviewDefault'];
/** Bind the Settings write endpoint to one Connection RPC face. */
export declare function createAutoReviewDefaultSetter(rpc: AutoReviewRpc): AutoReviewSectionInjected['setAutoReviewDefault'];
/** Settings section intentionally stays compact so the page remains scannable. */
export declare function AutoReviewSection({ loadAutoReviewDefault, setAutoReviewDefault, t }: AutoReviewSectionProps): import("react").JSX.Element | null;
