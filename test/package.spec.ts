import assert from 'node:assert/strict'
import test from 'node:test'
import { execFile } from 'node:child_process'
import { access, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

test('keeps provider-specific code under nested provider directories', async () => {
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

test('package metadata and bundles retain standalone Auto Review identity', async () => {
  const root = process.cwd()
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
    name: string
    version: string
    dependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    dsh: { client: { inject: string[] } }
    scripts: Record<string, string>
  }
  assert.equal(pkg.name, 'dsh-plugin-auto-review')
  assert.equal(pkg.version, '0.1.0')
  assert.equal(pkg.dependencies?.undici, undefined)
  assert.ok(pkg.peerDependencies?.['@deepseek-ai/dsh-api-remotes'])
  assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-api-remotes'))
  for (const service of [
    '@deepseek-ai/dsh-client-ui-conversation',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-ui-renderer',
    '@deepseek-ai/dsh-client-ui-settings',
    '@deepseek-ai/dsh-client-locale',
  ]) assert.ok(pkg.dsh.client.inject.includes(service), service)
  assert.match(pkg.scripts.prepublishOnly ?? '', /npm run build/)
  const bundle = await readFile(join(root, 'lib', 'client.js'), 'utf8')
  assert.match(bundle, /dsh-plugin-auto-review/)
  assert.doesNotMatch(bundle, /dsh-plugin-subscriptions|subscriptions-auth/)
  const patch = await readFile(join(root, 'cordis.patch.yml'), 'utf8')
  assert.match(patch, /id: auto-review/)
  assert.match(patch, /name: dsh-plugin-auto-review/)
})

test('prepare emits the declarations exported by the standalone package', async () => {
  const root = process.cwd()
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
  assert.match(pkg.scripts.prepare ?? '', /tsc/)
  const staleRootProvider = join(root, 'lib', 'codex-guardian.js')
  await writeFile(staleRootProvider, '// stale provider output\n')
  await execFileAsync('npm', ['run', 'prepare', '--silent'], { cwd: root })
  for (const declaration of ['lib/index.d.ts', 'lib/client/index.d.ts']) {
    const content = await readFile(join(root, declaration), 'utf8')
    assert.ok(content.trim().length > 0, declaration)
  }
  await assert.rejects(access(staleRootProvider), { code: 'ENOENT' })
  for (const relativePath of ['lib/providers/codex.js', 'lib/providers/grok.js']) {
    await assert.rejects(access(join(root, relativePath)), { code: 'ENOENT' })
  }
})

test('host bundle does not require the version-specific ToolCallId runtime export', async () => {
  const root = process.cwd()
  await execFileAsync('npm', ['run', 'prepare', '--silent'], { cwd: root })
  const bundle = await readFile(join(root, 'lib', 'index.js'), 'utf8')
  assert.doesNotMatch(
    bundle,
    /import\s*\{[^}]*\bToolCallId\b[^}]*\}\s*from\s*["']@deepseek-ai\/dsh-llm["']/s,
  )
})
