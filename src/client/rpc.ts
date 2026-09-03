import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'

/** Client-side Connection RPC face used by Auto Review controls. */
export type AutoReviewRpc = ConnectionHandle['rpc']

/** Error raised for either a transport failure or a rejected endpoint result. */
export class AutoReviewRpcError extends Error {
  constructor(message: string, readonly code = 'internal') {
    super(message)
    this.name = 'AutoReviewRpcError'
  }
}

/** Call one `/auto-review` endpoint and unwrap its current RpcResult value. */
export async function callAutoReview<T>(
  rpc: AutoReviewRpc,
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<T> {
  let result: Awaited<ReturnType<AutoReviewRpc['call']>>
  try {
    result = await rpc.call('/auto-review', endpoint, payload)
  } catch (error) {
    throw new AutoReviewRpcError(error instanceof Error ? error.message : String(error))
  }
  if (!result.ok) throw new AutoReviewRpcError(result.error.message, result.error.code)
  return result.value as T
}
