const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');
const prettier = require('eslint-config-prettier');

module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'no-useless-catch': 'warn',
      'preserve-caught-error': 'warn',
      'prefer-const': 'warn',
      'no-undef': 'off',
      'no-useless-escape': 'warn',
      'no-useless-assignment': 'warn',
      'no-constant-binary-expression': 'warn',
    },
  },
  {
    ignores: ['node_modules/', 'dist/', '.expo/', 'babel.config.js', 'jest.config.js', 'eslint.config.js'],
  },
);
