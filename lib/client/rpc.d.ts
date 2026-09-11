import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client';
/** Client-side Connection RPC face used by Auto Review controls. */
export type AutoReviewRpc = ConnectionHandle['rpc'];
/** Error raised for either a transport failure or a rejected endpoint result. */
export declare class AutoReviewRpcError extends Error {
    readonly code: string;
    constructor(message: string, code?: string);
}
/** Call one `/auto-review` endpoint and unwrap its current RpcResult value. */
export declare function callAutoReview<T>(rpc: AutoReviewRpc, endpoint: string, payload: Record<string, unknown>): Promise<T>;
