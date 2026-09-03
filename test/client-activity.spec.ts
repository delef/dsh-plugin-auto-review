import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createAutoReviewLoader,
  createAutoReviewSetter,
} from '../src/client/AutoReviewSelect.js'
import {
  createAutoReviewDefaultLoader,
  createAutoReviewDefaultSetter,
} from '../src/client/AutoReviewSection.js'
import {
  autoReviewActivityDefinition,
  formatAutoReviewActivity,
} from '../src/client/AutoReviewActivity.js'
import { callAutoReview, type AutoReviewRpc } from '../src/client/rpc.js'

interface RpcCall {
  readonly channel: string
  readonly endpoint: string
  readonly payload: unknown
}

function rpc(result: unknown, calls: RpcCall[]): AutoReviewRpc {
  return {
    call: async (channel, endpoint, payload) => {
      calls.push({ channel, endpoint, payload })
      return result as Awaited<ReturnType<AutoReviewRpc['call']>>
    },
  }
}

test('client helpers use /auto-review endpoint names and unwrap RpcResult values', async () => {
  const calls: RpcCall[] = []
  const connection = rpc({ ok: true, value: { reviewer: 'codex', reviewers: [] } }, calls)
  const sessionLoad = createAutoReviewLoader(connection, 'session-1')
  const sessionSet = createAutoReviewSetter(connection, 'session-1')
  const defaultLoad = createAutoReviewDefaultLoader(connection)
  const defaultSet = createAutoReviewDefaultSetter(connection)
  assert.equal((await sessionLoad()).reviewer, 'codex')
  assert.equal(await sessionSet('none'), true)
  assert.equal((await defaultLoad()).reviewer, 'codex')
  assert.equal((await defaultSet('none')).reviewer, 'codex')
  assert.deepEqual(calls.map(call => [call.channel, call.endpoint, call.payload]), [
    ['/auto-review', 'autoReview', { sessionId: 'session-1' }],
    ['/auto-review', 'setAutoReview', { sessionId: 'session-1', reviewer: 'none' }],
    ['/auto-review', 'autoReviewDefault', {}],
    ['/auto-review', 'setAutoReviewDefault', { reviewer: 'none' }],
  ])
})

test('client helpers handle transport and business errors without leaking the raw envelope', async () => {
  const failure = rpc({ ok: false, error: { code: 'bad-request', message: 'not currently usable', details: {} } }, [])
  await assert.rejects(() => callAutoReview(failure, 'setAutoReview', { sessionId: 's', reviewer: 'stale' }), /not currently usable/)
  assert.equal(await createAutoReviewSetter(failure, 's')('stale'), false)
})

test('activity projection pairs only auto-review asked/decided events and formats outcomes', () => {
  assert.equal(formatAutoReviewActivity('Codex', 'allowed-once'), 'Auto Review · Codex · Allowed')
  assert.equal(formatAutoReviewActivity('Codex', 'rejected'), 'Auto Review · Codex · Denied')
  const asked = {
    type: 'approval/asked',
    seq: 4,
    data: { id: 'auto-review-call-1', toolName: 'auto-review/codex', callId: 'call-1', reason: 'Codex' },
  } as unknown as Parameters<typeof autoReviewActivityDefinition.match>[0]
  const unrelated = { type: 'approval/asked', data: { id: 'human', toolName: 'bash' } } as unknown as Parameters<typeof autoReviewActivityDefinition.match>[0]
  assert.deepEqual(autoReviewActivityDefinition.match(asked), { id: 'auto-review-call-1', role: 'start' })
  assert.equal(autoReviewActivityDefinition.match(unrelated), null)
  const start = autoReviewActivityDefinition.start({} as never, {
    event: asked,
    role: 'start',
    location: { kind: 'unresolved' },
  }, {} as never)
  assert.deepEqual(start, { provider: 'Codex', callId: 'call-1', seq: 4 })
  const decided = {
    type: 'approval/decided',
    seq: 5,
    data: { id: 'auto-review-call-1', outcome: 'rejected' },
  } as unknown as Parameters<typeof autoReviewActivityDefinition.match>[0]
  const updated = autoReviewActivityDefinition.update({ state: start } as never, {
    event: decided,
    role: 'update',
    location: { kind: 'unresolved' },
  })
  assert.equal(updated.outcome, 'rejected')
})
