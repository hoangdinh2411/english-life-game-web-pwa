import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.mjs', '**/*.cjs'], languageOptions: { globals: { console: 'readonly', process: 'readonly', module: 'readonly', require: 'readonly', __dirname: 'readonly', fetch: 'readonly', URL: 'readonly' } } },
  { files: ['**/*.cjs'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
);
