import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCodexApprovalReview } from '../src/providers/codex.js'

test('guardian parser accepts only closed allow or deny JSON', () => {
  assert.equal(parseCodexApprovalReview('{"outcome":"allow"}')?.decision, 'allow')
  assert.equal(parseCodexApprovalReview('{"outcome":"ask"}'), undefined)
  assert.equal(parseCodexApprovalReview('not json'), undefined)
})
