#!/usr/bin/env node

import { existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

if (!existsSync(new URL('../src/generated/index.ts', import.meta.url))) {
  console.error('Client source is missing. Generate the recorded schema first.');
  process.exit(1);
}

rmSync(new URL('../dist/', import.meta.url), { recursive: true, force: true });
const result = spawnSync(
  process.execPath,
  [fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)), '-p', 'tsconfig.json'],
  { cwd: root, stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
