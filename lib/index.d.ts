/** Provider-backed automatic approval review for DeepSeek Harness. */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type GuardianConfig } from './providers/codex/index.js';
import { type GrokConfig } from './providers/grok/index.js';
export type { GuardianConfig } from './providers/codex/index.js';
export type { GrokConfig } from './providers/grok/index.js';
export declare const name = "auto-review";
export declare const inject: string[];
/** A provider-specific route selected by its explicit policy discriminator. */
export type ReviewerConfig = (GuardianConfig & {
    policy?: 'codex';
}) | (GrokConfig & {
    policy: 'grok';
});
export interface Config {
    autoReview?: 'none' | string;
    reviewers?: ReviewerConfig[];
}
/** Default route shipped by the standalone plugin. */
export declare const DEFAULT_REVIEWER: GuardianConfig;
/** Default Grok route; availability is checked dynamically by the router. */
export declare const DEFAULT_GROK_REVIEWER: GrokConfig;
/** Config schema with a usable Codex route when no route list is supplied. */
export declare const Config: z<Config>;
/** Compose reviewer routing, state/persistence, optional Tools, and RPC. */
export declare function apply(context: Context, config: Config): void;
