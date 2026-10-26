#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync,
  rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtures = join(root, 'test/consumer');
for (const file of ['runtime.mjs', 'types.ts', 'modules.ts']) {
  assert.ok(existsSync(join(fixtures, file)), `Missing real-client consumer: ${file}`);
}

const temporary = mkdtempSync(join(tmpdir(), 'vpsadmin-typescript-package-'));

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

try {
  const npmCli = process.env.npm_execpath;
  assert.ok(npmCli, 'Run through npm run test:package.');
  const [packed] = JSON.parse(run(
    process.execPath,
    [npmCli, 'pack', '--json', '--pack-destination', temporary],
    root,
  ));
  assert.ok(packed, 'npm pack did not report an archive.');
  for (const { path } of packed.files) {
    assert.ok(
      /^(package\.json|README(?:\.[^/]+)?|LICEN[CS]E(?:\.[^/]+)?|dist\/[^\s]+|schema\/[^/]+\.json|schema\/tooling\.Gemfile\.lock|tools\/generator\.json|src\/generated\/\.haveapi-generated\.json)$/.test(path),
      `Unexpected file in package: ${path}`,
    );
  }
  const files = new Set(packed.files.map(({ path }) => path));
  for (const file of [
    'dist/index.js', 'dist/index.d.ts', 'schema/schema.json', 'schema/provenance.json',
    'schema/tooling.Gemfile.lock', 'tools/generator.json', 'src/generated/.haveapi-generated.json',
  ]) {
    assert.ok(files.has(file), `Missing package entrypoint: ${file}`);
  }
  const ownership = JSON.parse(readFileSync(join(root, 'src/generated/.haveapi-generated.json'), 'utf8'));
  assert.equal(ownership.owner, 'haveapi-typescript-client');
  assert.equal(ownership.format, 1);
  for (const source of Object.keys(ownership.files)) {
    assert.ok(
      /^[A-Za-z0-9_./-]+\.ts$/.test(source)
        && source.split('/').every((segment) => segment !== '.' && segment !== '..'),
      `Invalid generated source path: ${source}`,
    );
    const stem = source.slice(0, -3);
    for (const extension of ['.js', '.d.ts']) {
      const artifact = `dist/generated/${stem}${extension}`;
      assert.ok(files.has(artifact), `Missing manifest-owned package artifact: ${artifact}`);
    }
  }

  run('tar', ['-xzf', join(temporary, packed.filename), '-C', temporary], root);
  const consumer = join(temporary, 'consumer');
  const modules = join(consumer, 'node_modules');
  mkdirSync(modules, { recursive: true });
  renameSync(join(temporary, 'package'), join(modules, 'vpsadmin-typescript-client'));
  symlinkSync(join(root, 'node_modules/haveapi-client'), join(modules, 'haveapi-client'), 'dir');
  cpSync(fixtures, consumer, { recursive: true });
  writeFileSync(join(consumer, 'package.json'), '{"type":"module","private":true}\n');
  writeFileSync(join(consumer, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
      strict: true, exactOptionalPropertyTypes: true, noUncheckedIndexedAccess: true,
      verbatimModuleSyntax: true,
      noEmit: true, types: [], lib: ['ES2022', 'DOM'],
      paths: { 'generated/*': ['./node_modules/vpsadmin-typescript-client/dist/generated/*'] },
    },
    files: ['types.ts', 'modules.ts'],
  }));

  const manifest = JSON.parse(readFileSync(join(modules, 'vpsadmin-typescript-client/package.json')));
  assert.equal(manifest.type, 'module');
  assert.equal(manifest.peerDependencies['haveapi-client'], '0.30.2');
  run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], consumer);
  run(process.execPath, ['runtime.mjs'], consumer);
  console.log('Packed ESM, strict types and executor consumer passed.');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
