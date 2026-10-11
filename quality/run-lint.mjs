import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const eslintRoot = dirname(require.resolve('eslint/package.json'));
const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
execFileSync(process.execPath, [join(eslintRoot, 'bin/eslint.js'), '--config', 'eslint.config.mjs', 'src'], {
  cwd: sourceRoot,
  stdio: 'inherit'
});
