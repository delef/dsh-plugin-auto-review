import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
test('package is standalone and has no subscription transport dependency', async () => {
  const pkg = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8'))
  assert.equal(pkg.name, 'dsh-plugin-auto-review')
  assert.equal(pkg.dependencies?.undici, undefined)
  for (const provider of ['codex', 'grok']) {
    const reviewer = await readFile(join(process.cwd(), `src/providers/${provider}/reviewer.ts`), 'utf8')
    assert.match(reviewer, /ctx\.llm\.stream/)
    assert.equal(reviewer.includes('/responses'), false)
    assert.equal(reviewer.includes('dsh-plugin-subscriptions'), false)
    assert.equal(reviewer.includes('accessToken'), false)
    assert.equal(reviewer.includes('refreshToken'), false)
  }
})
