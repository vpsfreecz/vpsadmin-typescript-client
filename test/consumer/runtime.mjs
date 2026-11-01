import assert from 'node:assert/strict';
import test from 'node:test';
import {
  API_VERSION, SCHEMA_SHA256, ClientInputError, createHaveApiExecutor, createVpsAdminClient,
} from 'vpsadmin-typescript-client';

test('generated modules compose behind the unchanged public package surface', async () => {
  const entrypoint = import.meta.resolve('vpsadmin-typescript-client');
  const module = (path) => import(new URL(`generated/${path}`, entrypoint));
  const [root, api, types, resource, action, child] = await Promise.all([
    import('vpsadmin-typescript-client'), module('api.js'), module('types.js'),
    module('resources/network/resource.js'), module('resources/network/actions/index.js'),
    module('resources/user/resources/public_key/resource.js'),
  ]);
  assert.equal(api.createClient, root.createClient);
  assert.deepEqual(Object.keys(types), []);
  for (const factory of ['createAction', 'createResource']) {
    assert.equal(Object.hasOwn(root, factory), false);
    assert.equal(Object.hasOwn(api, factory), false);
  }
  assert.equal(typeof resource.createResource, 'function');
  assert.equal(typeof action.createAction, 'function');
  assert.equal(typeof child.createResource, 'function');
});

test('versioned Network read preserves namespaces, options and partial response receipts', async () => {
  assert.equal(API_VERSION, '7.0');
  assert.equal(SCHEMA_SHA256, '476f0086726a443a6ef8ad9a9d499bd3feff6eb6c5b0b652dcc999192d638794');
  const signal = new AbortController().signal;
  const headers = { 'X-Request-Id': 'consumer' };
  const receipt = {
    data: [{ id: 1, label: null }], meta: { total_count: 1 },
    envelope: { status: true, response: { networks: [{ id: 1, label: null }] } },
    httpStatus: 200,
  };
  const calls = [];
  const client = createVpsAdminClient({ execute: async (spec) => { calls.push(spec); return receipt; } });
  const result = await client.network.index({
    params: { enabled: false, from_id: 0, limit: 0, usable_for: '', location: undefined },
    meta: { count: false, includes: 'primary_location' },
    signal, headers, timeoutMs: 50,
  });
  assert.equal(calls.length, 1);
  const [spec] = calls;
  assert.equal(spec.method, 'GET');
  assert.equal(spec.path, '/networks');
  assert.equal(spec.inputNamespace, 'network');
  assert.equal(spec.outputNamespace, 'networks');
  assert.equal(spec.metaNamespace, '_meta');
  assert.deepEqual({ ...spec.params }, { enabled: false, from_id: 0, limit: 0, usable_for: '' });
  assert.deepEqual({ ...spec.meta }, { count: false, includes: 'primary_location' });
  assert.equal(spec.signal, signal);
  assert.equal(spec.headers, headers);
  assert.equal(spec.timeoutMs, 50);
  for (const key of ['data', 'meta', 'envelope', 'httpStatus']) assert.equal(result[key], receipt[key]);
});

test('Network writes encode paths, keep false/zero/empty values and preserve runtime failures', async () => {
  const calls = [];
  const failure = new Error('write outcome is uncertain');
  const client = createVpsAdminClient({ execute: async (spec) => { calls.push(spec); throw failure; } });
  await assert.rejects(
    client.network.update({ path: { network_id: 'a/b' }, params: { label: '', enabled: false, prefix: 0 } }),
    (error) => error === failure,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'PUT');
  assert.equal(calls[0].path, '/networks/a%2Fb');
  assert.equal(calls[0].inputNamespace, 'network');
  assert.equal(calls[0].outputNamespace, 'network');
  assert.deepEqual({ ...calls[0].params }, { label: '', enabled: false, prefix: 0 });
  await assert.rejects(client.network.show({ path: { network_id: Number.MAX_SAFE_INTEGER + 1 } }), /safe integer/);
  await assert.rejects(client.network.index({ params: { limit: Number.MAX_SAFE_INTEGER + 1 } }), /safe integer/);
  await assert.rejects(client.network.index({ meta: { includes: ['primary_location'] } }), /Structured Custom query/);
  assert.equal(calls.length, 1, 'invalid local calls never reach the executor');
});

test('HaveAPI adapter preserves the request receiver and does not initialize the runtime', async () => {
  const receipt = { data: null, meta: {}, envelope: { status: true }, httpStatus: 204 };
  const spec = { method: 'GET', path: '/networks' };
  const runtime = {
    request(value) { assert.equal(this, runtime); assert.equal(value, spec); return Promise.resolve(receipt); },
    setup() { assert.fail('adapter must not discover the API'); },
    authenticate() { assert.fail('adapter must not change authentication'); },
  };
  assert.equal(await createHaveApiExecutor(runtime)(spec), receipt);
});

test('live descriptions use version-relative OPTIONS routes and preserve receipts', async () => {
  const calls = [];
  const signal = new AbortController().signal;
  const headers = { 'X-Request-Id': 'description-consumer' };
  const receipt = {
    data: { input: { parameters: { label: { type: 'String' } } } },
    meta: { extension: false }, envelope: { status: true }, httpStatus: 200,
  };
  const client = createVpsAdminClient({ execute: async (spec) => { calls.push(spec); return receipt; } });
  for (const result of [
    await client.describe({ headers, signal, timeoutMs: 50 }),
    await client.network.update.describe({ path: { network_id: 'a/b' }, headers, signal, timeoutMs: 50 }),
  ]) {
    for (const key of ['data', 'meta', 'envelope', 'httpStatus']) assert.equal(result[key], receipt[key]);
  }
  assert.deepEqual(calls.map(({ method, path }) => ({ method, path })), [
    { method: 'OPTIONS', path: '/' },
    { method: 'OPTIONS', path: '/networks/a%2Fb?method=PUT' },
  ]);
  for (const spec of calls) {
    assert.equal(spec.signal, signal);
    assert.equal(spec.headers, headers);
    assert.equal(spec.timeoutMs, 50);
  }
});

test('local input failures are distinguishable from uncertain executor failures', async () => {
  const failure = new TypeError('executor failure');
  let calls = 0;
  const client = createVpsAdminClient({ execute: async () => { calls += 1; throw failure; } });
  await assert.rejects(
    client.network.update.describe({ path: { network_id: Number.MAX_SAFE_INTEGER + 1 } }),
    (error) => error instanceof ClientInputError && error instanceof TypeError
      && error.code === 'HAVEAPI_CLIENT_INPUT_ERROR' && error.phase === 'pre-dispatch',
  );
  assert.equal(calls, 0);
  for (const operation of [
    () => client.describe(),
    () => client.network.update({ path: { network_id: 1 }, params: { label: '' } }),
  ]) {
    await assert.rejects(operation(), (error) => error === failure && !(error instanceof ClientInputError));
  }
  assert.equal(calls, 2);
});

test('a configured metadata namespace preserves raw receipts and canonical object metadata', async () => {
  const calls = [];
  const nested = { id: 2, _wire: { extension: true } };
  const objectMeta = { resolved: false, path_params: [7] };
  const row = { id: 7, _wire: objectMeta, primary_location: nested };
  const envelope = { status: true, response: { networks: [row], _wire: { total_count: 1 } } };
  const client = createVpsAdminClient({
    metaNamespace: '_wire',
    execute: async (spec) => {
      calls.push(spec);
      return { data: [row], meta: envelope.response._wire, envelope, httpStatus: 200 };
    },
  });
  const result = await client.network.index({ meta: { count: true } });
  assert.equal(calls[0].metaNamespace, '_wire');
  assert.equal(result.envelope, envelope);
  assert.equal(result.envelope.response.networks[0], row);
  assert.equal(row._wire, objectMeta);
  assert.deepEqual(result.data[0]._meta, objectMeta);
  assert.equal(result.data[0].primary_location, nested, 'nested association contents remain untouched');
  await client.network.update.describe({ path: { network_id: 7 } });
  assert.equal(calls[1].metaNamespace, '_wire');
});
