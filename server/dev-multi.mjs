import { spawn } from 'node:child_process';
import { join } from 'node:path';

const viteBin = join('node_modules', 'vite', 'bin', 'vite.js');

const children = [
  spawn(process.execPath, ['server/multiplayer-server.mjs'], { stdio: 'inherit' }),
  spawn(process.execPath, [viteBin], { stdio: 'inherit' }),
];

function stopChildren() {
  children.forEach((child) => {
    if (!child.killed) {
      child.kill();
    }
  });
}

children.forEach((child) => {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      stopChildren();
    }
  });
});

process.on('SIGINT', () => {
  stopChildren();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopChildren();
  process.exit(0);
});
