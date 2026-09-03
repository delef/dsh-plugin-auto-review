#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const packageDir = process.argv[2]
if (packageDir === undefined) {
  throw new Error('usage: node scripts/prepare-github-package.mjs <package-dir>')
}

const root = resolve(packageDir)
const manifestPath = join(root, 'package.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
if (manifest.name !== 'dsh-plugin-auto-review') {
  throw new Error(`unexpected npm package name: ${String(manifest.name)}`)
}

manifest.name = '@delef/dsh-plugin-auto-review'
manifest.publishConfig = { registry: 'https://npm.pkg.github.com' }
if (manifest.scripts !== undefined) {
  delete manifest.scripts.prepare
  delete manifest.scripts.prepublishOnly
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

const patchPath = join(root, 'cordis.patch.yml')
const patch = await readFile(patchPath, 'utf8')
const moduleName = /^(\s*name:\s*)dsh-plugin-auto-review([ \t]*)$/m
if (!moduleName.test(patch)) {
  throw new Error('cordis.patch.yml does not contain the expected package name')
}
await writeFile(patchPath, patch.replace(moduleName, "$1'@delef/dsh-plugin-auto-review'$2"))
