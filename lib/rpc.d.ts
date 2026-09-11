import type { Context } from '@deepseek-ai/cordis';
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection';
import type { AutoReviewController } from './auto-review-state.js';
/** The standalone logical RPC channel owned by this plugin. */
export declare const AUTO_REVIEW_CHANNEL = "/auto-review";
/** Backward-compatible descriptive alias for integrations naming channels explicitly. */
export declare const AUTO_REVIEW_RPC_CHANNEL = "/auto-review";
/** Stable result envelope returned by every Auto Review endpoint. */
export type RpcResult<T> = {
    readonly ok: true;
    readonly value: T;
} | {
    readonly ok: false;
    readonly error: {
        readonly code: string;
        readonly message: string;
        readonly details: object;
    };
};
export type { AutoReviewController, AutoReviewState } from './auto-review-state.js';
/** Payload shape rejected before any state or availability operation runs. */
export declare class BadRequest extends Error {
}
/**
 * Build the endpoint handler independently of Cordis so direct fixtures and
 * host integration tests exercise exactly the same validation path.
 */
export declare function createAutoReviewRpcHandler(controller: AutoReviewController): ConnectionRpcHandler;
/** Register `/auto-review` only when a host Connection service is present. */
export declare function registerAutoReviewRpc(context: Context, controller: AutoReviewController): void;
