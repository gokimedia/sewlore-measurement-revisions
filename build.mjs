import { build } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (manifest.version !== pkg.version || manifest.id.includes('obsidian') || manifest.description.length > 250 || !manifest.description.endsWith('.')) throw new Error('Invalid submission manifest.');
await mkdir('qa/compiled', { recursive: true });
await build({ entryPoints: ['src/main.ts'], outfile: 'main.js', bundle: true, platform: 'browser', target: 'es2021', format: 'cjs', external: ['obsidian'], minify: false, banner: { js: '/* Measurement Revisions — MIT © 2026 Sewlore. */' } });
await build({ entryPoints: ['src/core.ts'], outfile: 'qa/compiled/core.cjs', bundle: true, platform: 'node', target: 'es2021', format: 'cjs' });
console.log(JSON.stringify({ build: 'ok', main: 'main.js', nativeAppInstalledTested: false }));
