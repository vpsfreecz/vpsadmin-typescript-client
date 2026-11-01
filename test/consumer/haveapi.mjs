import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { AsyncClient } from 'haveapi-client';
import { ClientInputError, createHaveApiExecutor, createVpsAdminClient } from 'vpsadmin-typescript-client';

test('the packed client uses HaveAPI 0.32 transport and decoding on a mounted API', async (t) => {
  const requests = [];
  let response = { status: true, response: {} };
  let status = 200;
  const server = createServer(async (request, reply) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    requests.push({
      method: request.method, url: new URL(request.url, 'http://fixture.invalid'),
      headers: request.headers, body: Buffer.concat(chunks).toString(),
    });
    reply.writeHead(status, { 'Content-Type': 'application/json' });
    reply.end(typeof response === 'string' ? response : JSON.stringify(response));
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const runtime = new AsyncClient(`http://127.0.0.1:${server.address().port}/api/v7.0`);
  const api = createVpsAdminClient({ execute: createHaveApiExecutor(runtime) });

  response = {
    status: true,
    response: { networks: [{ id: 7, label: null }], _meta: { total_count: 1, extension: false } },
  };
  const page = await api.network.index({
    params: { enabled: false, limit: 0 }, meta: { count: true, includes: 'primary_location' },
    headers: { 'X-Consumer': 'archive' }, timeoutMs: 2_000,
  });
  assert.deepEqual(page.data, response.response.networks);
  assert.deepEqual(page.meta, response.response._meta);
  assert.deepEqual(page.envelope, response);
  assert.equal(page.httpStatus, 200);
  assert.equal(requests[0].url.pathname, '/api/v7.0/networks');
  assert.equal(requests[0].url.searchParams.get('network[enabled]'), 'false');
  assert.equal(requests[0].url.searchParams.get('network[limit]'), '0');
  assert.equal(requests[0].url.searchParams.get('_meta[count]'), 'true');
  assert.equal(requests[0].url.searchParams.get('_meta[includes]'), 'primary_location');
  assert.equal(requests[0].headers['x-consumer'], 'archive');

  response = { status: true, response: { network: {}, _meta: { action_state: 42 } } };
  const updated = await api.network.update({
    path: { network_id: 7 }, params: { label: '', enabled: false, prefix: 0 }, timeoutMs: 2_000,
  });
  assert.deepEqual(updated.envelope, response);
  assert.deepEqual(updated.meta, { action_state: 42 });
  assert.equal(requests[1].method, 'PUT');
  assert.equal(requests[1].url.pathname, '/api/v7.0/networks/7');
  assert.deepEqual(JSON.parse(requests[1].body), { network: { label: '', enabled: false, prefix: 0 } });

  response = { status: true, response: { authentication: {}, resources: {}, meta: { namespace: '_meta' } } };
  assert.deepEqual((await api.describe({ timeoutMs: 2_000 })).data, response.response);
  assert.equal(requests[2].method, 'OPTIONS');
  assert.equal(requests[2].url.pathname, '/api/v7.0/');
  response = { status: true, response: { input: { parameters: { label: { type: 'String' } } } } };
  assert.deepEqual((await api.network.update.describe({ path: { network_id: 7 }, timeoutMs: 2_000 })).data, response.response);
  assert.equal(requests[3].method, 'OPTIONS');
  assert.equal(requests[3].url.pathname, '/api/v7.0/networks/7');
  assert.equal(requests[3].url.searchParams.get('method'), 'PUT');

  const configured = createVpsAdminClient({ execute: createHaveApiExecutor(runtime), metaNamespace: '_wire' });
  const rawRow = { id: 7, _wire: { resolved: false }, primary_location: { id: 2, _wire: { nested: true } } };
  response = { status: true, response: { networks: [rawRow], _wire: { total_count: 1 } } };
  const configuredPage = await configured.network.index({ meta: { count: true }, timeoutMs: 2_000 });
  assert.equal(requests[4].url.searchParams.get('_wire[count]'), 'true');
  assert.equal(requests[4].url.searchParams.has('_meta[count]'), false);
  assert.deepEqual(configuredPage.meta, { total_count: 1 });
  assert.deepEqual(configuredPage.data[0]._meta, { resolved: false });
  assert.deepEqual(configuredPage.data[0].primary_location, rawRow.primary_location);
  assert.deepEqual(configuredPage.envelope, response);
  assert.deepEqual(configuredPage.envelope.response.networks[0]._wire, { resolved: false });
  response = { status: true, response: { input: { parameters: {} }, _wire: { probe: true } } };
  const configuredDescription = await configured.network.update.describe({ path: { network_id: 7 }, timeoutMs: 2_000 });
  assert.deepEqual(configuredDescription.meta, { probe: true });
  assert.deepEqual(configuredDescription.envelope, response);

  status = 403;
  response = { status: false, message: 'Denied by fixture', errors: {} };
  await assert.rejects(api.describe({ timeoutMs: 2_000 }), (error) => {
    assert.equal(error.kind, 'api');
    assert.equal(error.httpStatus, 403);
    assert.deepEqual(error.envelope, response);
    return !(error instanceof ClientInputError);
  });
  status = 200;
  response = 'invalid JSON';
  await assert.rejects(api.describe({ timeoutMs: 2_000 }), (error) => error.kind === 'protocol' && !(error instanceof ClientInputError));
  const sent = requests.length;
  await assert.rejects(
    api.network.update({ path: { network_id: Number.MAX_SAFE_INTEGER + 1 }, params: { label: '' } }),
    ClientInputError,
  );
  assert.equal(requests.length, sent, 'invalid generated inputs never reach the HTTP runtime');
});
