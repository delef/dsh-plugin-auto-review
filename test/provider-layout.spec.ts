import assert from 'node:assert/strict'
import test from 'node:test'
import { access } from 'node:fs/promises'
import { join } from 'node:path'

test('keeps each provider implementation in its own nested directory', async () => {
  const root = process.cwd()
  for (const relativePath of [
    'src/providers/codex/index.ts',
    'src/providers/codex/policy.ts',
    'src/providers/codex/prompt.ts',
    'src/providers/codex/reviewer.ts',
    'src/providers/grok/index.ts',
    'src/providers/grok/policy.ts',
    'src/providers/grok/prompt.ts',
    'src/providers/grok/reviewer.ts',
  ]) {
    await access(join(root, relativePath))
  }
  for (const relativePath of [
    'src/providers/codex.ts',
    'src/providers/codex-guardian-policy.ts',
    'src/providers/grok.ts',
    'src/providers/grok-auto-policy.ts',
  ]) {
    await assert.rejects(access(join(root, relativePath)), { code: 'ENOENT' })
  }
})
