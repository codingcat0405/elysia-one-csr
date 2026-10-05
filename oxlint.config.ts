import { defineConfig } from 'oxlint'

export default defineConfig({
  plugins: ['typescript', 'unicorn', 'oxc', 'import', 'react', 'jsx-a11y'],
  categories: { correctness: 'error', suspicious: 'warn' },
  ignorePatterns: ['**/dist/**', '**/node_modules/**', '**/.turbo/**'],
  rules: {
    'import/no-cycle': 'off',
    'sort-imports': 'off',
    'typescript/array-type': 'off',
    'require-await': 'off',
    // Automatic JSX runtime ("jsx": "react-jsx") — `React` never needs to be in scope.
    'react/react-in-jsx-scope': 'off',
    // Real correctness signal; kept as a warning (shipping requires 0 warnings,
    // see AGENTS.md "Before shipping").
    'react/set-state-in-effect': 'warn',
  },
})
