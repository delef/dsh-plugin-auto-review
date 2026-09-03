import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
test('package is standalone and has no subscription transport dependency', async () => {
  const pkg = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8'))
  assert.equal(pkg.name, 'dsh-plugin-auto-review')
  assert.equal(pkg.dependencies?.undici, undefined)
  const guardian = await readFile(join(process.cwd(), 'src/codex-guardian.ts'), 'utf8')
  assert.equal(guardian.includes('/responses'), false)
  assert.equal(guardian.includes('dsh-plugin-subscriptions'), false)
})
