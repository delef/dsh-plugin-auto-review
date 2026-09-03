import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { AutoReviewDefaultStore } from '../src/auto-review-default.js'
import { inheritedSessionSetting } from '../src/session-settings.js'

test('global default persists atomically with private permissions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'auto-review-'))
  try {
    const path = join(root, 'settings.json')
    const store = new AutoReviewDefaultStore('none', id => id === 'codex', () => undefined, path)
    await store.set('codex')
    assert.equal(JSON.parse(await readFile(path, 'utf8')).reviewer, 'codex')
    assert.equal((await stat(path)).mode & 0o777, 0o600)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('malformed or unknown persisted defaults fail closed to the configured bootstrap', async () => {
  const root = await mkdtemp(join(tmpdir(), 'auto-review-'))
  try {
    const path = join(root, 'settings.json')
    await writeFile(path, '{not-json')
    const warnings: string[] = []
    const malformed = new AutoReviewDefaultStore('codex', id => id === 'codex', message => warnings.push(message), path)
    assert.equal(await malformed.get(), 'codex')
    assert.equal(warnings.length, 1)

    await writeFile(path, JSON.stringify({ reviewer: 'unknown' }))
    warnings.length = 0
    const unknown = new AutoReviewDefaultStore('codex', id => id === 'codex', message => warnings.push(message), path)
    assert.equal(await unknown.get(), 'codex')
    assert.equal(warnings.length, 1)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('session choice inherits nearest parent and detects loops', () => {
  const values = new Map([['parent', 'codex'], ['root', 'none']])
  assert.equal(inheritedSessionSetting(values, 'child', id => id === 'child' ? 'parent' : id === 'parent' ? 'root' : undefined), 'codex')
  assert.equal(inheritedSessionSetting(new Map(), 'a', id => id === 'a' ? 'b' : 'a'), undefined)
})
