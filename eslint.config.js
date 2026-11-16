import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [{
  files: ['src/**/*.ts'],
  languageOptions: { parser: tsParser, parserOptions: { sourceType: 'module', ecmaVersion: 2022 } },
  plugins: { '@typescript-eslint': tsPlugin },
  rules: { ...tsPlugin.configs.recommended.rules }
}];
