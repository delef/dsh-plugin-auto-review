/** Self-contained prepare build for git installs without the monorepo compiler. */
import { defineConfig } from 'tsdown'
import clientConfig from './tsdown.config.js'

export default defineConfig([{
  name: 'dsh-plugin-auto-review',
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
}, clientConfig])
