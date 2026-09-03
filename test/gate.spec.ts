import assert from 'node:assert/strict'
import test from 'node:test'
import { AutoReviewGate, ApprovalReviewRouter } from '../src/auto-review.js'

const agent: any = { id: 's', session: { events: [], surface: { nodes: [] }, append() {} }, cancel() {} }
test('selected unavailable reviewer fails closed after a matching native approval', async () => {
  const router = new ApprovalReviewRouter([{ reviewerId: 'codex', reviewerLabel: 'Codex', async available() { return false }, async reviewApproval() { return undefined } }], () => 'codex')
  const gate = new AutoReviewGate(router)
  await gate.preExecute({ name: 'bash', callId: 'call' as any, arguments: {}, agent, signal: new AbortController().signal }, async () => ({ kind: 'ask' } as any))
  const outcome = await gate.answerApproval({ agent, toolName: 'bash', callId: 'call' as any }, async () => 'allowed-once' as any)
  assert.equal(outcome, 'rejected')
})

test('selected unavailable reviewer audits an unavailable route without model or native fallback', async () => {
  const events: Array<{ type: string; data: unknown }> = []
  const auditedAgent: any = {
    ...agent,
    session: {
      ...agent.session,
      events,
      append(type: string, data: unknown) {
        events.push({ type, data })
      },
    },
  }
  let modelCalls = 0
  let nativeFallbackCalls = 0
  const router = new ApprovalReviewRouter([{
    reviewerId: 'codex',
    reviewerLabel: 'Codex',
    async reviewApproval() { return undefined },
  }], () => 'codex')
  const gate = new AutoReviewGate(router)
  await gate.preExecute({ name: 'bash', callId: 'call' as any, arguments: {}, agent: auditedAgent, signal: new AbortController().signal }, async () => ({ kind: 'ask' } as any))
  const outcome = await gate.answerApproval({ agent: auditedAgent, toolName: 'bash', callId: 'call' as any }, async () => {
    nativeFallbackCalls += 1
    return 'allowed-once' as any
  })
  assert.equal(outcome, 'rejected')
  assert.equal(modelCalls, 0)
  assert.equal(nativeFallbackCalls, 0)
  assert.deepEqual(events, [
    {
      type: 'approval/asked',
      data: { id: 'auto-review-call', toolName: 'auto-review/codex', callId: 'call', reason: 'Codex' },
    },
    {
      type: 'approval/decided',
      data: { id: 'auto-review-call', outcome: 'unavailable' },
    },
  ])
})

test('no reviewer preserves native manual flow', async () => {
  const gate = new AutoReviewGate(new ApprovalReviewRouter([], () => undefined))
  assert.equal(await gate.answerApproval({ agent, toolName: 'bash' }, async () => 'allowed-once' as any), 'allowed-once')
})

test('selection stays registered for fail-closed routing while options and review probe availability', async () => {
  let reviewed = 0
  const router = new ApprovalReviewRouter([{
    reviewerId: 'codex',
    reviewerLabel: 'Codex',
    async available() { throw new Error('route probe failed') },
    async reviewApproval() {
      reviewed += 1
      return { decision: 'allow', reason: 'not reached' }
    },
  }], () => 'codex')
  assert.equal(await router.hasReviewer(agent), true)
  assert.deepEqual(await router.availableOptions(), [])
  assert.equal((await router.review({ agent, action: { name: 'bash', callId: 'call' as any, arguments: {} }, signal: new AbortController().signal }))?.decision, 'allow')
  assert.equal(reviewed, 1)
})
