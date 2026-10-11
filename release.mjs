import { execFileSync } from 'node:child_process';
execFileSync('python', ['release.py'], { stdio: 'inherit' });
