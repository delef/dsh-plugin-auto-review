import type { Context } from '@deepseek-ai/cordis'
import type {
  ConnectionRpcHandler,
  HostConnectionHandle,
} from '@deepseek-ai/dsh-client-connection'
import type { AutoReviewController } from './auto-review-state.js'

/** The standalone logical RPC channel owned by this plugin. */
export const AUTO_REVIEW_CHANNEL = '/auto-review'
/** Backward-compatible descriptive alias for integrations naming channels explicitly. */
export const AUTO_REVIEW_RPC_CHANNEL = AUTO_REVIEW_CHANNEL

/** Stable result envelope returned by every Auto Review endpoint. */
export type RpcResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string; readonly details: object } }

export type { AutoReviewController, AutoReviewState } from './auto-review-state.js'

/** Payload shape rejected before any state or availability operation runs. */
export class BadRequest extends Error {}

type RpcHandleCompat = (
  channel: string,
  handler: ConnectionRpcHandler,
  options?: { readonly authority: 'loopback' },
) => () => Promise<void>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRecord(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) throw new BadRequest('payload must be an object')
  return payload
}

function readSessionId(payload: unknown): string {
  const sessionId = readRecord(payload).sessionId
  if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    throw new BadRequest('payload.sessionId must be a non-empty string')
  }
  return sessionId
}

function readReviewer(payload: unknown): string {
  const reviewer = readRecord(payload).reviewer
  if (typeof reviewer !== 'string' || reviewer.trim().length === 0) {
    throw new BadRequest('payload.reviewer must be a non-empty string')
  }
  return reviewer
}

function ok<T>(value: T): RpcResult<T> {
  return { ok: true, value }
}

function failure(error: unknown): RpcResult<never> {
  const message = error instanceof Error ? error.message : String(error)
  const code = error instanceof BadRequest ? 'bad-request' : 'internal'
  return { ok: false, error: { code, message, details: code === 'bad-request' ? { issues: [] } : {} } }
}

/**
 * Build the endpoint handler independently of Cordis so direct fixtures and
 * host integration tests exercise exactly the same validation path.
 */
export function createAutoReviewRpcHandler(controller: AutoReviewController): ConnectionRpcHandler {
  return async (endpoint, payload, _signal): Promise<RpcResult<unknown>> => {
    try {
      switch (endpoint) {
        case 'autoReview':
          return ok(await controller.autoReview(readSessionId(payload)))
        case 'setAutoReview': {
          const record = readRecord(payload)
          const sessionId = readSessionId(record)
          const reviewer = readReviewer(record)
          if (!await controller.setAutoReview(sessionId, reviewer)) {
            throw new BadRequest('payload.reviewer is not currently usable')
          }
          return ok({ ok: true })
        }
        case 'autoReviewDefault':
          readRecord(payload)
          return ok(await controller.autoReviewDefault())
        case 'setAutoReviewDefault': {
          const reviewer = readReviewer(payload)
          const state = await controller.setAutoReviewDefault(reviewer)
          if (state === undefined) throw new BadRequest('payload.reviewer is not currently usable')
          return ok(state)
        }
        default:
          throw new BadRequest(`unknown Auto Review endpoint: ${endpoint}`)
      }
    } catch (error) {
      return failure(error)
    }
  }
}

/** Register `/auto-review` only when a host Connection service is present. */
export function registerAutoReviewRpc(context: Context, controller: AutoReviewController): void {
  context.inject(['connection'], scope => {
    const connection = scope.get('connection') as HostConnectionHandle
    const handler = createAutoReviewRpcHandler(controller)
    scope.effect(
      () => (connection.rpc.handle as RpcHandleCompat)(AUTO_REVIEW_CHANNEL, handler, { authority: 'loopback' }),
      'dsh-plugin-auto-review: /auto-review rpc channel',
    )
  })
}
