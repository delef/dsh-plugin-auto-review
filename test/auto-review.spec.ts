import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import {
  ApprovalReviewRouter,
  AutoReviewGate,
  installAutoReview,
  type ApprovalReviewHostAgent,
  type ApprovalReviewRequest,
  type ApprovalReviewSessionEvent,
  type ApprovalReviewer,
} from '../src/auto-review.js'

let sequence = 0

type Asked = Extract<ApprovalReviewSessionEvent, { type: 'approval/asked' }>
type Decided = Extract<ApprovalReviewSessionEvent, { type: 'approval/decided' }>

function fixtureAgent(
  events: ApprovalReviewSessionEvent[] = [],
  origin?: 'subagent',
): ApprovalReviewHostAgent {
  sequence += 1
  function append(type: Asked['type'], data: Asked['data']): Asked
  function append(type: Decided['type'], data: Decided['data']): Decided
  function append(type: Asked['type'] | Decided['type'], data: Asked['data'] | Decided['data']): Asked | Decided {
    const event = { type, seq: events.length, time: 0, data } as Asked | Decided
    events.push(event)
    return event
  }
  return {
    id: `agent-${sequence}`,
    session: {
      events,
      surface: { nodes: [] },
      ...(origin === undefined ? {} : { header: { origin } }),
      append,
    },
    cancel() {},
  }
}

function reviewer(
  id: string,
  review: (request: ApprovalReviewRequest) => ReturnType<ApprovalReviewer['reviewApproval']>,
  available?: () => Promise<boolean>,
): ApprovalReviewer {
  return {
    reviewerId: id,
    reviewerLabel: id,
    ...(available === undefined ? {} : { available }),
    reviewApproval: review,
  }
}

function execution(agent: ApprovalReviewHostAgent, callId = 'call-1') {
  return {
    name: 'bash',
    callId: ToolCallId(callId),
    agent,
    signal: new AbortController().signal,
    arguments: {
      command: 'git fetch upstream',
      workdir: '/repo',
      sandbox_permissions: 'danger-full-access',
      justification: 'Network access is required.',
    },
  }
}

test('pre-execute captures without routing, then routes the exact approval request', async () => {
  const agent = fixtureAgent()
  const requests: ApprovalReviewRequest[] = []
  const gate = new AutoReviewGate(new ApprovalReviewRouter([
    reviewer('codex', async request => {
      requests.push(request)
      return { decision: 'allow', reason: 'Scoped.' }
    }),
  ], () => 'codex'))

  const pre = await gate.preExecute(execution(agent), async () => ({
    kind: 'ask',
    reason: 'Needs network access.',
  }))
  assert.deepEqual(pre, { kind: 'ask', reason: 'Needs network access.' })
  assert.equal(requests.length, 0)

  assert.equal(await gate.answerApproval({
    agent,
    callId: ToolCallId('call-1'),
    toolName: 'bash',
    reason: 'Needs network access.',
  }, async () => 'rejected'), 'allowed-once')
  assert.equal(requests.length, 1)
  assert.equal(requests[0]?.action.name, 'bash')
  assert.deepEqual(requests[0]?.action.arguments, execution(agent).arguments)
  assert.equal(requests[0]?.reason, 'Needs network access.')
})

test('matching approval is consumed once and cannot be confused with another tool or call id', async () => {
  const agent = fixtureAgent()
  let reviews = 0
  let manual = 0
  const gate = new AutoReviewGate(new ApprovalReviewRouter([
    reviewer('codex', async () => {
      reviews += 1
      return { decision: 'allow', reason: 'Scoped.' }
    }),
  ], () => 'codex'))
  await gate.preExecute(execution(agent), async () => ({ kind: 'ask' }))

  assert.equal(await gate.answerApproval({ agent, callId: ToolCallId('other'), toolName: 'bash' }, async () => {
    manual += 1
    return 'allowed-once'
  }), 'rejected')
  assert.equal(await gate.answerApproval({ agent, callId: ToolCallId('call-1'), toolName: 'write_file' }, async () => {
    manual += 1
    return 'allowed-once'
  }), 'rejected')
  assert.equal(await gate.answerApproval({ agent, callId: ToolCallId('call-1'), toolName: 'bash' }, async () => {
    manual += 1
    return 'allowed-once'
  }), 'allowed-once')
  assert.equal(await gate.answerApproval({ agent, callId: ToolCallId('call-1'), toolName: 'bash' }, async () => {
    manual += 1
    return 'allowed-once'
  }), 'rejected')
  assert.equal(reviews, 1)
  assert.equal(manual, 0)
})

test('allow, deny, unavailable, and cancellation have exact audit outcomes', async () => {
  const cases = [
    { id: 'allow', review: async () => ({ decision: 'allow' as const, reason: 'ok' }), expected: 'allowed-once', audit: 'allowed-once' },
    { id: 'deny', review: async () => ({ decision: 'deny' as const, reason: 'no' }), expected: 'rejected', audit: 'rejected' },
    { id: 'ask', review: async () => ({ decision: 'ask' as const, reason: 'maybe' }), expected: 'rejected', audit: 'unavailable' },
    { id: 'failure', review: async () => { throw new Error('offline') }, expected: 'rejected', audit: 'unavailable' },
  ] as const
  for (const item of cases) {
    const events: ApprovalReviewSessionEvent[] = []
    const agent = fixtureAgent(events)
    const gate = new AutoReviewGate(new ApprovalReviewRouter([reviewer('codex', item.review)], () => 'codex'))
    await gate.preExecute(execution(agent, item.id), async () => ({ kind: 'ask' }))
    assert.equal(await gate.answerApproval({ agent, callId: ToolCallId(item.id), toolName: 'bash' }, async () => 'allowed-once'), item.expected)
    assert.equal(events.at(-2)?.type, 'approval/asked')
    assert.equal(events.at(-1)?.type, 'approval/decided')
    assert.equal((events.at(-1) as Decided).data.outcome, item.audit)
  }

  const events: ApprovalReviewSessionEvent[] = []
  const agent = fixtureAgent(events)
  const signal = AbortSignal.abort()
  const gate = new AutoReviewGate(new ApprovalReviewRouter([reviewer('codex', async () => { throw new Error('offline') })], () => 'codex'))
  await gate.preExecute(execution(agent, 'cancel'), async () => ({ kind: 'ask' }))
  assert.equal(await gate.answerApproval({ agent, callId: ToolCallId('cancel'), toolName: 'bash', signal }, async () => 'allowed-once'), 'cancelled')
  assert.equal((events.at(-1) as Decided).data.outcome, 'cancelled')
})

test('selected unavailable reviewers and delegated subagents never fall through to a human', async () => {
  let manual = 0
  const unavailable = fixtureAgent()
  const unavailableGate = new AutoReviewGate(new ApprovalReviewRouter([
    reviewer('codex', async () => undefined, async () => false),
  ], () => 'codex'))
  await unavailableGate.preExecute(execution(unavailable), async () => ({ kind: 'ask' }))
  assert.equal(await unavailableGate.answerApproval({ agent: unavailable, callId: ToolCallId('call-1'), toolName: 'bash' }, async () => {
    manual += 1
    return 'allowed-once'
  }), 'rejected')

  const child = fixtureAgent([], 'subagent')
  const childGate = new AutoReviewGate(new ApprovalReviewRouter([], () => undefined))
  await childGate.preExecute(execution(child), async () => ({ kind: 'ask' }))
  assert.equal(await childGate.answerApproval({ agent: child, callId: ToolCallId('call-1'), toolName: 'bash' }, async () => {
    manual += 1
    return 'allowed-once'
  }), 'rejected')
  assert.equal(manual, 0)
})

test('no selected reviewer preserves native manual approval', async () => {
  const agent = fixtureAgent()
  let manual = 0
  const gate = new AutoReviewGate(new ApprovalReviewRouter([], () => undefined))
  assert.equal(await gate.answerApproval({ agent, toolName: 'bash' }, async () => {
    manual += 1
    return 'allowed-once'
  }), 'allowed-once')
  assert.equal(manual, 1)
})

test('selected registered reviewer routes directly without a shared availability probe', async () => {
  let reviewed = 0
  const router = new ApprovalReviewRouter([reviewer(
    'codex',
    async () => {
      reviewed += 1
      return { decision: 'allow', reason: 'Scoped.' }
    },
    async () => false,
  )], () => 'codex')
  const result = await router.review({
    agent: fixtureAgent(),
    action: { name: 'bash', callId: ToolCallId('call-1'), arguments: {} },
    signal: new AbortController().signal,
  })
  assert.equal(reviewed, 1)
  assert.equal(result?.decision, 'allow')
})

test('a selected reviewer fail-closes after the 64-call candidate eviction bound', async () => {
  const agent = fixtureAgent()
  let manual = 0
  let reviews = 0
  const gate = new AutoReviewGate(new ApprovalReviewRouter([reviewer('codex', async () => {
    reviews += 1
    return { decision: 'allow', reason: 'Scoped.' }
  })], () => 'codex'))
  await gate.preExecute(execution(agent, 'evicted'), async () => ({ kind: 'ask' }))
  for (let index = 0; index < 64; index += 1) {
    await gate.preExecute(execution(agent, `keep-${index}`), async () => ({ kind: 'ask' }))
  }
  assert.equal(await gate.answerApproval({ agent, callId: ToolCallId('evicted'), toolName: 'bash' }, async () => {
    manual += 1
    return 'allowed-once'
  }), 'rejected')
  assert.equal(reviews, 0)
  assert.equal(manual, 0)
})

test('an allowed Bash call can trigger the same reviewer on later sandbox escalation', async () => {
  const context = new Context()
  const agent = fixtureAgent()
  let reviews = 0
  installAutoReview(context, new ApprovalReviewRouter([reviewer('codex', async () => {
    reviews += 1
    return { decision: 'allow', reason: 'Scoped.' }
  })], () => 'codex'))
  const gate = new AutoReviewGate(new ApprovalReviewRouter([reviewer('codex', async () => {
    reviews += 1
    return { decision: 'allow', reason: 'Scoped.' }
  })], () => 'codex'))
  await gate.preExecute(execution(agent, 'escalation'), async () => ({ kind: 'allow' }))
  assert.equal(await gate.answerApproval({ agent, callId: ToolCallId('escalation'), toolName: 'bash' }, async () => 'rejected'), 'allowed-once')
  assert.equal(reviews, 1)
  assert.equal(context.events._hooks['tools/pre-execute']?.[0]?.prepend, true)
})

test('installer registers all three wrappers first in hook order', () => {
  const context = new Context()
  installAutoReview(context, new ApprovalReviewRouter([], () => undefined))
  for (const name of ['tools/pre-execute', 'tools/post-execute', 'approval/request'] as const) {
    assert.equal(context.events._hooks[name]?.length, 1)
    assert.equal(context.events._hooks[name]?.[0]?.prepend, true)
  }
})

test('sandbox escalation climbs two rungs, refuses mismatches/full-access, and preserves additional contexts', async () => {
  const context = new Context()
  const agent = fixtureAgent()
  const retries: any[] = []
  context.provide('tools', {
    async execute(input: any) {
      retries.push(input)
      return {
        isError: false,
        value: { kind: 'foreground', sandbox: { mode: 'danger-full-access', denied: false } },
        content: [{ type: 'text', text: 'ok' }],
        additionalContexts: [{ id: 'context' }],
      }
    },
  })
  installAutoReview(context, new ApprovalReviewRouter([reviewer('codex', async () => ({ decision: 'allow', reason: 'Scoped.' }))], () => 'codex'))
  const hook = context.events._hooks['tools/post-execute']?.[0]?.callback as any
  assert.equal(typeof hook, 'function')
  const base = execution(agent, 'sandbox')
  const result = (mode: string, requested: string | undefined, isError = false): any => ({
    isError,
    value: isError ? undefined : { kind: 'foreground', sandbox: { mode, denied: true } },
    content: [{ type: 'text', text: 'denied' }],
  })
  const accepted = await hook({ ...base, rootCallId: ToolCallId('root'), token: Symbol('token'), arguments: { command: 'touch x', sandbox_permissions: 'read-only' } }, result('read-only', 'read-only'), async () => ({ kind: 'accept' }))
  assert.equal(retries[0]?.arguments.sandbox_permissions, 'workspace-write')
  assert.equal(accepted.kind, 'accept')
  assert.deepEqual(accepted.additionalContexts, [{ id: 'context' }])

  await hook({ ...base, callId: ToolCallId('rung-two'), rootCallId: ToolCallId('root'), token: Symbol('token'), arguments: { command: 'touch x', sandbox_permissions: 'workspace-write' } }, result('workspace-write', 'workspace-write'), async () => ({ kind: 'accept' }))
  assert.equal(retries[1]?.arguments.sandbox_permissions, 'danger-full-access')
  await hook({ ...base, callId: ToolCallId('mismatch'), rootCallId: ToolCallId('root'), token: Symbol('token'), arguments: { command: 'touch x', sandbox_permissions: 'read-only' } }, result('workspace-write', 'read-only'), async () => ({ kind: 'accept' }))
  await hook({ ...base, callId: ToolCallId('full'), rootCallId: ToolCallId('root'), token: Symbol('token'), arguments: { command: 'touch x', sandbox_permissions: 'danger-full-access' } }, result('danger-full-access', 'danger-full-access'), async () => ({ kind: 'accept' }))
  await hook({ ...base, callId: ToolCallId('error'), rootCallId: ToolCallId('root'), token: Symbol('token'), arguments: { command: 'touch x', sandbox_permissions: 'read-only' } }, result('read-only', 'read-only', true), async () => ({ kind: 'accept' }))
  assert.equal(retries.length, 2)
})
