import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { AsyncClient } from 'haveapi-client';
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
  assert.equal(SCHEMA_SHA256, 'd6ec617653913c56e92398a6032aa350118597a0e3f45c599bc92b6071ea0a26');
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

test('live descriptions use saved method selectors and encoded paths through the executor', async () => {
  const calls = [];
  const receipt = { data: { input: { parameters: {} } }, meta: {}, envelope: { status: true }, httpStatus: 200 };
  const client = createVpsAdminClient({ execute: async (spec) => { calls.push(spec); return receipt; } });
  const signal = new AbortController().signal;
  const headers = { 'X-Request-Id': 'describe' };
  assert.equal(await client.describe({ signal, headers, timeoutMs: 50 }), receipt);
  assert.equal(await client.network.update.describe({ path: { network_id: 'a/b' }, signal, headers, timeoutMs: 50 }), receipt);
  assert.deepEqual(calls.map(({ method, path }) => ({ method, path })), [
    { method: 'OPTIONS', path: '/' },
    { method: 'OPTIONS', path: '/networks/a%2Fb?method=PUT' },
  ]);
  for (const spec of calls) {
    assert.equal(spec.metaNamespace, '_meta');
    assert.equal(spec.inputNamespace, null);
    assert.equal(spec.outputNamespace, null);
    assert.equal(spec.signal, signal);
    assert.equal(spec.headers, headers);
    assert.equal(spec.timeoutMs, 50);
  }
  await assert.rejects(client.network.update.describe({ path: { network_id: 1 }, params: { label: 'forbidden' } }), ClientInputError);
  await assert.rejects(client.describe({ path: '/arbitrary' }), ClientInputError);
  assert.equal(calls.length, 2, 'description options cannot submit writes or arbitrary routes');
});

test('only generated failures carry the pre-dispatch input error identity', async () => {
  let calls = 0;
  const failure = new TypeError('transport outcome is uncertain');
  const client = createVpsAdminClient({ execute: async () => { calls++; throw failure; } });
  await assert.rejects(client.network.show({ path: { network_id: '..' } }), (error) => {
    assert.ok(error instanceof TypeError);
    assert.ok(error instanceof ClientInputError);
    assert.equal(error.code, 'HAVEAPI_CLIENT_INPUT_ERROR');
    assert.equal(error.phase, 'pre-dispatch');
    return true;
  });
  assert.equal(calls, 0);
  assert.throws(() => createVpsAdminClient({ execute: async () => {}, metaNamespace: '__proto__' }), ClientInputError);
  await assert.rejects(client.network.update({ path: { network_id: 1 }, params: { label: 'sent' } }), (error) => {
    assert.equal(error, failure);
    assert.equal(error instanceof ClientInputError, false);
    return true;
  });
  assert.equal(calls, 1, 'transport failures are neither relabeled nor replayed');
});

test('published runtime sends descriptions, writes and metadata through a mounted API', async () => {
  const calls = [];
  const server = createServer(async (request, response) => {
    let text = '';
    for await (const chunk of request) text += chunk;
    const url = new URL(request.url, 'http://fixture.invalid');
    calls.push({ method: request.method, url, body: text ? JSON.parse(text) : undefined });
    response.setHeader('Content-Type', 'application/json');
    const data = request.method === 'OPTIONS'
      ? { resources: {}, input: { parameters: { label: { type: 'String' } } } }
      : request.method === 'GET'
        ? { networks: [{ id: 1, wire_meta: { resolved: false } }], wire_meta: { total_count: 1 } }
        : { network: { id: 1, label: null }, wire_meta: {} };
    response.end(JSON.stringify({ status: true, response: data }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const runtime = new AsyncClient(`http://127.0.0.1:${server.address().port}/mount/v7.0`);
    const client = createVpsAdminClient({ execute: createHaveApiExecutor(runtime), metaNamespace: 'wire_meta' });
    const options = { timeoutMs: 5000 };
    await client.describe(options);
    const description = await client.network.update.describe({ path: { network_id: 'a/b' }, ...options });
    assert.equal(description.data.input.parameters.label.type, 'String');
    const list = await client.network.index({ params: { enabled: false, limit: 0 }, meta: { count: false }, ...options });
    assert.equal(list.meta.total_count, 1);
    assert.deepEqual(list.data[0]._meta, { resolved: false });
    assert.equal(list.envelope.response.networks[0]._meta, undefined);
    assert.deepEqual(list.envelope.response.networks[0].wire_meta, { resolved: false });
    const write = await client.network.update({ path: { network_id: 1 }, params: { label: '', enabled: false, prefix: 0 }, meta: { no: false }, ...options });
    assert.equal(write.data.label, null);
    assert.equal(write.httpStatus, 200);
    assert.deepEqual(calls.map(({ method, url }) => [method, url.pathname]), [
      ['OPTIONS', '/mount/v7.0/'],
      ['OPTIONS', '/mount/v7.0/networks/a%2Fb'],
      ['GET', '/mount/v7.0/networks'],
      ['PUT', '/mount/v7.0/networks/1'],
    ]);
    assert.equal(calls[1].url.search, '?method=PUT');
    assert.deepEqual([...calls[2].url.searchParams].sort(), [['network[enabled]', 'false'], ['network[limit]', '0'], ['wire_meta[count]', 'false']]);
    assert.deepEqual(calls[3].body, { network: { label: '', enabled: false, prefix: 0 }, wire_meta: { no: false } });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
