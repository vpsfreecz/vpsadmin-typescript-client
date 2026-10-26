#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE = 'vpsadmin-typescript-client';
export const REPOSITORY = 'vpsfreecz/vpsadmin-typescript-client';
const repositoryUrl = `git+https://github.com/${REPOSITORY}.git`;

export function preflight({ manifest, lock, tag, repository, enabled, onMain, licenseFile }) {
  assert.equal(enabled, 'true', 'Set NPM_RELEASE_ENABLED=true only after release setup is complete.');
  assert.equal(repository, REPOSITORY, 'Publishing repository does not match.');
  assert.equal(manifest.name, PACKAGE, 'Package name does not match.');
  assert.equal(manifest.repository?.url, repositoryUrl, 'Package repository metadata does not match.');
  assert.match(manifest.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, 'Use a stable package version.');
  assert.notEqual(manifest.version, '0.0.0', 'Placeholder version cannot be released.');
  assert.equal(tag, `v${manifest.version}`, 'Release tag must exactly match the package version.');
  assert.ok(manifest.private === undefined || manifest.private === false, 'Private packages cannot be published.');
  assert.equal(lock.name, manifest.name, 'Lockfile package name differs.');
  assert.equal(lock.version, manifest.version, 'Lockfile package version differs.');
  assert.equal(lock.packages?.['']?.name, manifest.name, 'Lockfile root package name differs.');
  assert.equal(lock.packages?.['']?.version, manifest.version, 'Lockfile root package version differs.');
  assert.ok(typeof manifest.license === 'string' && manifest.license.trim() && manifest.license !== 'UNLICENSED', 'Choose release license metadata.');
  assert.ok(licenseFile, 'A license file is required.');
  assert.ok(onMain, 'Release commit must be on main.');
}

export function receipt({ archive, filename, manifest, commit, tag = null }) {
  assert.equal(manifest.name, PACKAGE, 'Archive package name differs.');
  assert.match(commit, /^[0-9a-f]{40}$/, 'Invalid source commit.');
  assert.equal(filename, basename(filename), 'Archive filename must be a basename.');
  assert.match(filename, /^[A-Za-z0-9._-]+\.tgz$/, 'Invalid archive filename.');
  return {
    package: manifest.name, version: manifest.version, commit, tag, filename,
    sha256: createHash('sha256').update(archive).digest('hex'),
    integrity: `sha512-${createHash('sha512').update(archive).digest('base64')}`,
  };
}

export function verifyReceipt(saved, input) {
  assert.deepEqual(receipt(input), saved, 'Retained archive identity or bytes differ from the receipt.');
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function main(args) {
  const [mode, ...rest] = args;
  const options = {};
  while (rest.length) {
    const flag = rest.shift();
    assert.ok(['--archive', '--receipt', '--output'].includes(flag) && rest.length && !options[flag], 'Invalid release helper arguments.');
    options[flag] = rest.shift();
  }
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
  const tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : null;
  const commit = run('git', ['rev-parse', 'HEAD']);
  if (mode === 'preflight') {
    preflight({
      manifest, lock: JSON.parse(readFileSync('package-lock.json', 'utf8')), tag,
      repository: process.env.GITHUB_REPOSITORY, enabled: process.env.NPM_RELEASE_ENABLED,
      onMain: spawnSync('git', ['merge-base', '--is-ancestor', commit, 'refs/remotes/origin/main']).status === 0,
      licenseFile: ['LICENSE', 'LICENSE.txt', 'LICENSE.md'].some((path) => existsSync(path)),
    });
    console.log('Release prerequisites verified.');
    return;
  }
  assert.ok(['receipt', 'verify'].includes(mode) && options['--archive'], 'Expected preflight, receipt or verify command.');
  const archivePath = resolve(options['--archive']);
  const archived = JSON.parse(run('tar', ['-xOzf', archivePath, 'package/package.json']));
  assert.equal(archived.name, manifest.name, 'Archive name differs from source.');
  assert.equal(archived.version, manifest.version, 'Archive version differs from source.');
  const input = { archive: readFileSync(archivePath), filename: basename(archivePath), manifest: archived, commit, tag };
  if (mode === 'receipt') {
    assert.ok(options['--output'], 'Receipt output is required.');
    writeFileSync(options['--output'], `${JSON.stringify(receipt(input), null, 2)}\n`, { flag: 'wx' });
  } else {
    assert.ok(options['--receipt'], 'Saved receipt is required.');
    verifyReceipt(JSON.parse(readFileSync(options['--receipt'], 'utf8')), input);
    console.log('Retained archive identity and integrity verified.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`Release refused: ${error.message}`); process.exitCode = 1; }
}
