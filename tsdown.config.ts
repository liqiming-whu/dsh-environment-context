import { defineConfig } from 'tsdown'

export default defineConfig([
  { entry: ['src/index.ts'], format: ['esm'], dts: true, clean: true, outDir: 'lib', external: [/^@deepseek-ai\//] },
  { entry: { client: 'src/client/index.tsx' }, format: ['cjs'], platform: 'browser', dts: true, outDir: 'lib', external: [/^@deepseek-ai\//, /^react(?:\/.*)?$/], banner: 'window.__ModuleLoader__.load({ id: "dsh-environment-context", factory: (require) => { var module = { exports: {} }; var exports = module.exports;', footer: 'return module.exports; } });' },
])
