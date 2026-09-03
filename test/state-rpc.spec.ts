import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ApprovalReviewRouter, type ApprovalReviewer } from '../src/auto-review.js'
import { AutoReviewDefaultStore } from '../src/auto-review-default.js'
import {
  AutoReviewStateStore,
  type AutoReviewSessionLike,
} from '../src/auto-review-state.js'
import { createAutoReviewRpcHandler } from '../src/rpc.js'

function reviewer(available: () => boolean): ApprovalReviewer {
  return {
    reviewerId: 'codex',
    reviewerLabel: 'Codex',
    available: async () => available(),
    reviewApproval: async () => ({ decision: 'allow', reason: 'test' }),
  }
}

async function stateFixture(initial = 'none') {
  const root = await mkdtemp(join(tmpdir(), 'auto-review-state-'))
  const path = join(root, 'auto-review.json')
  let live = true
  const router = new ApprovalReviewRouter([reviewer(() => live)], () => 'codex')
  const defaults = new AutoReviewDefaultStore(initial, router.hasConfiguredReviewer.bind(router), () => undefined, path)
  const parents = new Map<string, string>()
  const state = new AutoReviewStateStore(router, defaults, id => parents.get(id))
  return { root, path, router, defaults, state, parents, setLive: (value: boolean) => { live = value } }
}

test('state keeps a configured reviewer visible and fail-closed while its route is unavailable', async () => {
  const fixture = await stateFixture('codex')
  try {
    fixture.setLive(false)
    assert.deepEqual(await fixture.state.autoReviewDefault(), {
      reviewer: 'codex',
      reviewers: [],
    })
    assert.equal(await fixture.state.setAutoReview('session-1', 'codex'), false)
    fixture.setLive(true)
    assert.equal(await fixture.state.setAutoReview('session-1', 'codex'), true)
    fixture.setLive(false)
    assert.deepEqual(await fixture.state.autoReview('session-1'), {
      reviewer: 'codex',
      reviewers: [],
    })
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test('session choices inherit from the nearest real lineage and collapse redundant overrides', async () => {
  const fixture = await stateFixture('none')
  try {
    fixture.parents.set('grandchild', 'child')
    fixture.parents.set('child', 'parent')
    await fixture.state.setAutoReview('parent', 'codex')
    assert.equal((await fixture.state.autoReview('grandchild')).reviewer, 'codex')
    assert.equal(await fixture.state.setAutoReview('child', 'codex'), true)
    assert.equal((await fixture.state.autoReview('child')).reviewer, 'codex')
    assert.equal(await fixture.state.setAutoReview('child', 'none'), true)
    assert.equal((await fixture.state.autoReview('grandchild')).reviewer, 'none')
    fixture.parents.set('loop-a', 'loop-b')
    fixture.parents.set('loop-b', 'loop-a')
    assert.equal((await fixture.state.autoReview('loop-a')).reviewer, 'none')
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test('delegated session creation snapshots the inherited reviewer and reopens only machine-reviewed policy', async () => {
  const fixture = await stateFixture('codex')
  try {
    const events: Array<{ type: string; data: Record<string, unknown> }> = [{
      type: 'approval/policy',
      data: { policy: 'never', source: 'delegation' },
    }]
    const session: AutoReviewSessionLike = {
      id: 'child',
      header: { parentSession: 'parent', origin: 'subagent' },
      events,
      append(type, data) { events.push({ type, data }) },
    }
    await fixture.state.setAutoReview('parent', 'codex')
    fixture.state.onSessionCreated(session)
    assert.equal((await fixture.state.autoReview('child')).reviewer, 'codex')
    assert.deepEqual(events.at(-1), {
      type: 'approval/policy',
      data: { policy: 'ask', source: 'delegation' },
    })
    const assembly = {
      contexts: [{ name: 'subagent:delegation', text: 'Operations requiring approval are rejected.' }],
    }
    fixture.state.onSystemPromptAssemble(assembly, { agent: { id: 'child', session } })
    assert.equal(
      assembly.contexts[0]?.text,
      'Automatic approval review is enabled for this delegated subagent. Operations that require approval '
        + 'may request it through the configured reviewer; no human prompt is available, and a denied or '
        + 'unavailable review remains denied.',
    )
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test('RPC handler validates payloads and exposes stable result envelopes', async () => {
  const fixture = await stateFixture()
  try {
    const handler = createAutoReviewRpcHandler(fixture.state)
    const signal = new AbortController().signal
    assert.deepEqual(await handler('autoReview', { sessionId: 's1' }, signal), {
      ok: true,
      value: { reviewer: 'none', reviewers: [{ reviewer: 'codex', label: 'Codex' }] },
    })
    assert.deepEqual(await handler('setAutoReview', { sessionId: 's1', reviewer: 'codex' }, signal), {
      ok: true,
      value: { ok: true },
    })
    const malformed = await handler('setAutoReview', { reviewer: 'codex' }, signal)
    assert.equal(malformed.ok, false)
    if (!malformed.ok) assert.equal(malformed.error.code, 'bad-request')
    const unsupported = await handler('unknown', {}, signal)
    assert.equal(unsupported.ok, false)
    if (!unsupported.ok) assert.equal(unsupported.error.code, 'bad-request')
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})
