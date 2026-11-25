import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { AsyncClient } from 'haveapi-client';
import { createHaveApiExecutor, createVpsAdminClient } from 'vpsadmin-typescript-client';

test('disable backups submits once with optional booleans and an ordinary receipt', async () => {
  const calls = [];
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    calls.push({ method: request.method, path: request.url, body: body ? JSON.parse(body) : {} });
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ status: true, response: { dataset: {}, _meta: { action_state_id: 41 } } }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const runtime = new AsyncClient(`http://127.0.0.1:${server.address().port}/v7.0`);
    const api = createVpsAdminClient({ execute: createHaveApiExecutor(runtime) });
    const path = { dataset_id: 7 };
    const options = [
      { path },
      { path, params: { recursive: true } },
      { path, params: { backup_first: false, recursive: false } },
      { path, params: { backup_first: true, recursive: true } },
    ];
    const expected = [{}, { recursive: true }, { backup_first: false, recursive: false }, { backup_first: true, recursive: true }];
    for (const [index, option] of options.entries()) {
      const accepted = await api.dataset.disable_backups(option);
      assert.equal(calls.length, index + 1, 'one explicit mutation submits exactly one request');
      assert.equal(calls[index].method, 'POST');
      assert.equal(calls[index].path, '/v7.0/datasets/7/disable_backups');
      assert.deepEqual(calls[index].body.dataset, expected[index]);
      assert.deepEqual(accepted.data, {});
      assert.equal(accepted.meta.action_state_id, 41);
      assert.deepEqual(accepted.envelope, { status: true, response: { dataset: {}, _meta: { action_state_id: 41 } } });
    }
    for (const call of calls.slice(0, 2)) {
      assert.equal(Object.hasOwn(call.body.dataset ?? {}, 'backup_first'), false, 'omission leaves the server default enabled');
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
