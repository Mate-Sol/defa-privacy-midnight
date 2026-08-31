import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Files cloned verbatim from the DeFa Arc FE. The port deliberately changed
    // only the data layer and actions — rewriting these to satisfy lint would
    // reintroduce exactly the visual drift the clone exists to avoid. Their
    // pre-existing style issues are downgraded here rather than "fixed"; code
    // written for this repo (src/midnight/**, src/libs/midnightPools.js) is
    // still held to the full ruleset.
    files: [
      'src/Mock/**',
      'src/components/**',
      'src/dashboard/**',
      'src/pages/**',
    ],
    rules: {
      'no-unused-vars': 'off',
      'react-refresh/only-export-components': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    // Our own React context legitimately exports a hook alongside the provider.
    files: ['src/midnight/context.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
