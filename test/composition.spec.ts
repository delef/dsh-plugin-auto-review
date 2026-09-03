import assert from 'node:assert/strict'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { apply, Config, DEFAULT_REVIEWER, type GuardianConfig } from '../src/index.js'
import { ApprovalReviewRouter } from '../src/auto-review.js'
import { type ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'

function llm() {
  return {
    listProviders: () => [{ id: 'codex', name: 'Codex' }],
    resolveModelInfo: async () => ({ provider: 'codex', id: 'codex-auto-review', name: 'Codex' }),
    stream: async function* () { yield { type: 'finish', reason: { kind: 'stop' } } as const },
  }
}

test('config accepts Codex Guardian route arrays and router rejects duplicate ids', () => {
  const config = Config({
    autoReview: 'api-guardian',
    reviewers: [
      DEFAULT_REVIEWER,
      { reviewerId: 'api-guardian', label: 'API Guardian', provider: 'api', model: 'review-model' },
    ],
  })
  assert.equal(config.reviewers?.[1]?.provider, 'api')
  assert.throws(() => new ApprovalReviewRouter([
    { reviewerId: 'codex', reviewerLabel: 'Codex', reviewApproval: async () => undefined },
    { reviewerId: 'codex', reviewerLabel: 'Codex again', reviewApproval: async () => undefined },
  ], () => undefined), /duplicate approval reviewer: codex/)
})

test('config rejects empty or whitespace-only reviewer route fields with exact errors', () => {
  const fields = ['reviewerId', 'label', 'provider', 'model', 'reasoningEffort'] as const
  for (const field of fields) {
    const route: GuardianConfig = {
      reviewerId: 'guardian',
      label: 'Guardian',
      provider: 'api',
      model: 'review-model',
      reasoningEffort: 'low',
    }
    route[field] = '   '
    const expected = `$.reviewers[0].${field} expect string to match regexp /\\S+/`
    assert.throws(
      () => Config({ reviewers: [route] }),
      error => error instanceof Error && error.message === expected,
    )
    assert.throws(
      () => apply(new Context(), { reviewers: [route] }),
      error => error instanceof Error && error.message === expected,
    )
  }
})

test('config preserves non-empty route strings without trimming', () => {
  const route = {
    reviewerId: ' guardian ',
    label: ' Guardian ',
    provider: ' api ',
    model: ' review-model ',
    reasoningEffort: ' low ',
  }
  assert.deepEqual(Config({ reviewers: [route] }).reviewers?.[0], route)
})

test('composition waits for optional Tools while still mounting Connection RPC', async () => {
  const context = new Context()
  context.provide('llm', llm())
  const registrations: Array<{ channel: string; handler: ConnectionRpcHandler; authority?: string | undefined }> = []
  context.provide('connection', {
    rpc: {
      handle(channel: string, handler: ConnectionRpcHandler, options?: { authority: 'loopback' }) {
        registrations.push({ channel, handler, authority: options?.authority })
        return async () => undefined
      },
    },
  })
  apply(context, { autoReview: 'none', reviewers: [DEFAULT_REVIEWER] })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(registrations[0]?.channel, '/auto-review')
  assert.equal(registrations[0]?.authority, 'loopback')
  assert.equal(context.events._hooks['tools/pre-execute']?.length ?? 0, 0)

  context.provide('tools', { execute: async () => undefined })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(context.events._hooks['tools/pre-execute']?.length, 1)
  assert.equal(context.events._hooks['tools/post-execute']?.length, 1)
  assert.equal(context.events._hooks['approval/request']?.length, 1)
})

test('missing Connection does not short-circuit optional Tools or lifecycle hooks', async () => {
  const context = new Context()
  context.provide('llm', llm())
  context.provide('tools', { execute: async () => undefined })
  apply(context, { autoReview: 'none', reviewers: [DEFAULT_REVIEWER] })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(context.events._hooks['tools/pre-execute']?.length, 1)
  assert.equal(context.events._hooks['session/created']?.length, 1)
  assert.equal(context.events._hooks['system-prompt/assemble']?.length, 1)
})
