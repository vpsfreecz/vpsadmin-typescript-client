import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const source = process.env.HAVEAPI_SOURCE;
assert.ok(source, 'Set HAVEAPI_SOURCE to the recorded local generator checkout.');
const pin = JSON.parse(readFileSync(join(root, 'tools/generator.json'), 'utf8'));

function command(program, args, cwd) {
  const result = spawnSync(program, args, { cwd, encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${program} failed:\n${result.stderr}`);
  return result.stdout.trim();
}

test('offline source selection binds shared identity and rejects changed shared inputs before output', () => {
  assert.equal(command('git', ['rev-parse', 'HEAD'], source), pin.haveapi_revision);
  const temporary = mkdtempSync(join(tmpdir(), 'vpsadmin-generator-sources-'));
  const checkout = join(temporary, 'haveapi');
  const marker = join(root, 'src/generated/.haveapi-generated.json');
  const before = readFileSync(marker);
  try {
    command('git', ['clone', '--shared', '--quiet', source, checkout], root);
    assert.equal(command('git', ['rev-parse', 'HEAD'], checkout), pin.haveapi_revision);
    const identity = JSON.parse(command('ruby', [
      '-I', join(checkout, 'clients/ruby/lib'), '-I', join(checkout, 'clients/typescript/lib'),
      join(root, 'tools/generator-source.rb'), 'identity', checkout,
    ], root));
    assert.deepEqual(identity.shared_source_identity, pin.shared_source_identity);
    assert.equal(identity.generator_source_sha256, pin.generator_source_sha256);
    const preloaded = spawnSync('ruby', [
      '-I', join(checkout, 'clients/ruby/lib'), '-I', join(checkout, 'clients/typescript/lib'),
      '-r', join(source, 'clients/ruby/lib/haveapi/schema.rb'),
      join(root, 'tools/generator-source.rb'), 'identity', checkout,
    ], { cwd: root, encoding: 'utf8' });
    assert.notEqual(preloaded.status, 0, 'Shared source from another checkout was accepted.');
    assert.match(preloaded.stderr, /Shared schema source was not loaded from the exact checkout/);

    for (const file of ['clients/ruby/lib/haveapi/schema/snapshot.rb', 'clients/ruby/lib/haveapi/client/version.rb']) {
      const path = join(checkout, file);
      const original = readFileSync(path);
      writeFileSync(path, Buffer.concat([original, Buffer.from('\n# source-selection regression\n')]));
      const result = spawnSync(process.execPath, [join(root, 'tools/regenerate'), '--haveapi-source', checkout, '--check'], {
        cwd: root, encoding: 'utf8',
      });
      assert.notEqual(result.status, 0, `Dirty shared input was accepted: ${file}`);
      assert.match(result.stderr, /git failed/);
      assert.deepEqual(readFileSync(marker), before);
      writeFileSync(path, original);
    }
    writeFileSync(join(checkout, 'clients/ruby/lib/haveapi/schema/untracked.rb'), '# untracked shared source\n');
    const result = spawnSync(process.execPath, [join(root, 'tools/regenerate'), '--haveapi-source', checkout, '--check'], {
      cwd: root, encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /untracked source files/);
    assert.deepEqual(readFileSync(marker), before);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
