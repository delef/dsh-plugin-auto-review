import type { Context as ClientContext } from '@deepseek-ai/cordis';
/** Required browser services; each registration remains owned by its slot fiber. */
export declare const inject: string[];
export type { AutoReviewMode, AutoReviewOption, AutoReviewSelectInjected, AutoReviewSelectProps, AutoReviewState, } from './AutoReviewSelect.js';
export type { AutoReviewSectionInjected, AutoReviewSectionProps } from './AutoReviewSection.js';
export type { AutoReviewKey } from './locales.js';
export { AutoReviewRpcError, callAutoReview } from './rpc.js';
export type { AutoReviewRpc } from './rpc.js';
/** Register this plugin's copy and all UI contribution points. */
export declare function apply(ctx: ClientContext): void;
