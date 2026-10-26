import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PACKAGE, REPOSITORY, preflight, receipt, verifyReceipt } from '../tools/release.mjs';

test('the actual workflow heredoc writes one newline-terminated producer output', () => {
  const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  const [, code] = workflow.match(/node --input-type=module <<'JS'\n([\s\S]*?)\n\s+JS/);
  const directory = mkdtempSync(join(tmpdir(), 'vpsadmin-workflow-output-'));
  const output = join(directory, 'output');
  try {
    const result = spawnSync(process.execPath, ['--input-type=module'], {
      input: code, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: output },
    });
    assert.equal(result.status, 0, result.stderr);
    const { haveapi_revision: revision } = JSON.parse(readFileSync(new URL('../tools/generator.json', import.meta.url)));
    assert.equal(readFileSync(output, 'utf8'), `revision=${revision}\n`);
    assert.deepEqual(readFileSync(output, 'utf8').trimEnd().split('\n'), [`revision=${revision}`]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('the actual workflow guard refuses tag rebuilds while leaving publish-only retries alone', () => {
  const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  const [build, publish] = workflow.split('\n  publish:\n');
  const [, guard] = build.match(/- name: Refuse repeated tag builds\n\s+run: \|\n([\s\S]*?)\n      - uses:/);
  assert.ok(build.indexOf('Refuse repeated tag builds') < build.indexOf('- uses:'));
  for (const [type, attempt, refused] of [['tag', '1', false], ['tag', '2', true], ['tag', '3', true], ['branch', '2', false]]) {
    const result = spawnSync('sh', ['-eu', '-c', guard], {
      encoding: 'utf8', env: { ...process.env, GITHUB_REF_TYPE: type, GITHUB_RUN_ATTEMPT: attempt },
    });
    assert.equal(result.status, refused ? 1 : 0, result.stderr);
    if (refused) assert.match(result.stdout, /Retry only the failed publish job with the original artifact/);
  }
  assert.doesNotMatch(publish, /GITHUB_RUN_ATTEMPT|Refuse repeated tag builds/);
  assert.match(publish, /needs: build/);
  assert.match(publish, /artifact-ids: \$\{\{ needs\.build\.outputs\.artifact-id \}\}/);
});

test('ordinary newline-terminated tar listings reach package completeness validation', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vpsadmin-archive-regular-'));
  try {
    mkdirSync(join(directory, 'package'));
    writeFileSync(join(directory, 'package', 'package.json'), '{}\n');
    const archive = join(directory, 'regular.tgz');
    const packed = spawnSync('tar', ['-czf', archive, '-C', directory, 'package'], { encoding: 'utf8' });
    assert.equal(packed.status, 0, packed.stderr);
    const listed = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' });
    assert.equal(listed.status, 0, listed.stderr);
    assert.ok(listed.stdout.endsWith('\n'));
    const result = spawnSync(process.execPath, ['tools/check-package.mjs', '--archive', archive], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Missing package entrypoint: dist\/index.js/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('existing-archive validation rejects links before extracting package contents', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vpsadmin-archive-link-'));
  try {
    mkdirSync(join(directory, 'package'));
    symlinkSync('/tmp', join(directory, 'package', 'link'));
    const archive = join(directory, 'linked.tgz');
    const packed = spawnSync('tar', ['-czf', archive, '-C', directory, 'package'], { encoding: 'utf8' });
    assert.equal(packed.status, 0, packed.stderr);
    const result = spawnSync(process.execPath, ['tools/check-package.mjs', '--archive', archive], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Archive contains a link or special file/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

function ready() {
  return {
    manifest: { name: PACKAGE, version: '1.2.3', private: false, license: 'MIT',
      repository: { url: `git+https://github.com/${REPOSITORY}.git` } },
    lock: { name: PACKAGE, version: '1.2.3', packages: { '': { name: PACKAGE, version: '1.2.3' } } },
    tag: 'v1.2.3', repository: REPOSITORY, enabled: 'true', onMain: true, licenseFile: true,
  };
}

test('release preflight requires an activated stable licensed package on main', () => {
  assert.doesNotThrow(() => preflight(ready()));
  const changes = [
    (x) => { x.enabled = ''; }, (x) => { x.repository = 'fork/client'; },
    (x) => { x.manifest.name = 'another-client'; }, (x) => { x.manifest.repository.url = 'https://example.test'; },
    (x) => { x.manifest.version = '0.0.0'; x.tag = 'v0.0.0'; },
    (x) => { x.manifest.version = '1.2.3-beta.1'; }, (x) => { x.tag = 'v1.2.4'; },
    (x) => { x.manifest.private = true; }, (x) => { x.lock.version = '1.2.4'; },
    (x) => { x.lock.packages[''].name = 'another-client'; },
    (x) => { delete x.manifest.license; }, (x) => { x.licenseFile = false; }, (x) => { x.onMain = false; },
  ];
  for (const change of changes) { const input = ready(); change(input); assert.throws(() => preflight(input)); }
});

test('the retained receipt binds archive bytes, source, tag and package identity', () => {
  const input = { archive: Buffer.from('approved archive'), filename: 'client-1.2.3.tgz', manifest: ready().manifest,
    commit: 'a'.repeat(40), tag: 'v1.2.3' };
  const saved = receipt(input);
  assert.match(saved.integrity, /^sha512-/);
  assert.doesNotThrow(() => verifyReceipt(saved, input));
  for (const changed of [
    { archive: Buffer.from('changed archive') }, { filename: 'another.tgz' }, { commit: 'b'.repeat(40) },
    { tag: 'v1.2.4' }, { manifest: { ...input.manifest, version: '1.2.4' } },
  ]) assert.throws(() => verifyReceipt(saved, { ...input, ...changed }));
  assert.throws(() => receipt({ ...input, manifest: { ...input.manifest, name: 'another-client' } }));
  assert.throws(() => receipt({ ...input, filename: '../client.tgz' }));
});
