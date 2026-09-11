/** Error raised for either a transport failure or a rejected endpoint result. */
export class AutoReviewRpcError extends Error {
    code;
    constructor(message, code = 'internal') {
        super(message);
        this.code = code;
        this.name = 'AutoReviewRpcError';
    }
}
/** Call one `/auto-review` endpoint and unwrap its current RpcResult value. */
export async function callAutoReview(rpc, endpoint, payload) {
    let result;
    try {
        result = await rpc.call('/auto-review', endpoint, payload);
    }
    catch (error) {
        throw new AutoReviewRpcError(error instanceof Error ? error.message : String(error));
    }
    if (!result.ok)
        throw new AutoReviewRpcError(result.error.message, result.error.code);
    return result.value;
}
