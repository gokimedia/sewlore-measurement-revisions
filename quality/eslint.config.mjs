import { defineConfig } from 'eslint/config';
import { fileURLToPath } from 'node:url';
import obsidianmd from 'eslint-plugin-obsidianmd';
export default defineConfig([
  ...obsidianmd.configs.recommended,
  { languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: fileURLToPath(new URL('../', import.meta.url)) } } }
]);
