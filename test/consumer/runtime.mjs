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
  assert.equal(SCHEMA_SHA256, 'a4c81b6df4e0e167ddc3c888c66be173282061fcb0f80fe19205f4a372d64326');
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

test('advisory mutations send revision and state guards through the published runtime', async () => {
  const calls = [];
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    calls.push({ method: request.method, path: request.url, body: body ? JSON.parse(body) : undefined });
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({
      status: true,
      response: { security_advisory: {}, security_advisory_cve: {}, node_status: {} },
    }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const runtime = new AsyncClient(`http://127.0.0.1:${server.address().port}/mount/v7.0`);
    const client = createVpsAdminClient({ execute: createHaveApiExecutor(runtime) });
    const advisoryPath = { security_advisory_id: 10 };
    const cvePath = { security_advisory_cve_id: 20 };
    const nodePath = { ...advisoryPath, node_status_id: 30 };
    const guards = { expected_content_revision: 0, expected_state: 'draft' };
    const mutations = [
      [client.security_advisory.update, advisoryPath, {}, 'PUT', '/security_advisories/10', 'security_advisory'],
      [client.security_advisory_cve.create, undefined, { security_advisory: 10, cve_id: 'CVE-2026-12345' }, 'POST', '/security_advisory_cves', 'security_advisory_cve'],
      [client.security_advisory_cve.update, cvePath, {}, 'PUT', '/security_advisory_cves/20', 'security_advisory_cve'],
      [client.security_advisory_cve.delete, cvePath, {}, 'DELETE', '/security_advisory_cves/20', 'security_advisory_cve'],
      [client.security_advisory.node_status.create, advisoryPath, { node: 40, state: 'unknown' }, 'POST', '/security_advisories/10/node_statuses', 'node_status'],
      [client.security_advisory.node_status.update, nodePath, {}, 'PUT', '/security_advisories/10/node_statuses/30', 'node_status'],
      [client.security_advisory.node_status.delete, nodePath, {}, 'DELETE', '/security_advisories/10/node_statuses/30', 'node_status'],
      [client.security_advisory.retract, advisoryPath, { expected_state: 'published' }, 'POST', '/security_advisories/10/retract', 'security_advisory'],
      [client.security_advisory.delete, advisoryPath, {}, 'DELETE', '/security_advisories/10', 'security_advisory'],
    ];
    for (const [action, path, fields, method, route, namespace] of mutations) {
      const params = { ...guards, ...fields };
      await action({ ...(path ? { path } : {}), params, timeoutMs: 5000 });
      assert.deepEqual(calls.at(-1), { method, path: `/mount/v7.0${route}`, body: { [namespace]: params } });
    }
    assert.equal(calls.length, mutations.length, 'each guarded mutation dispatches once');
    await assert.rejects(client.security_advisory.delete({ path: advisoryPath, params: { expected_state: 'draft' } }), ClientInputError);
    await assert.rejects(client.security_advisory.retract({ path: advisoryPath, params: { expected_content_revision: 0, expected_state: null } }), ClientInputError);
    assert.equal(calls.length, mutations.length, 'invalid local guards never reach the server');
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});


test('generic policy resources preserve string keys, authoritative updates and shared permission', async () => {
  const calls = [];
  const rows = ['alpha_policy', 'beta_policy'].map((key, index) => ({
    key, label: `Policy ${index}`, configuration_valid: true,
    count_7d: index, count_30d: index + 1, warning_limit: 5, stop_limit: 10,
    warning_limit_override: null, stop_limit_override: null,
    global_mode: 'enforce', effective_mode: 'enforce', stop_enforced: false,
  }));
  const server = createServer(async (request, response) => {
    let text = '';
    for await (const chunk of request) text += chunk;
    const url = new URL(request.url, 'http://fixture.invalid');
    calls.push({ method: request.method, url, body: text ? JSON.parse(text) : undefined });
    response.setHeader('Content-Type', 'application/json');
    let output;
    if (url.pathname.endsWith('/incident_policies')) output = { incident_policies: rows };
    else if (url.pathname.includes('/incident_policies/')) output = { incident_policy: rows.find(({ key }) => url.pathname.endsWith(`/${key}`)) };
    else output = request.method === 'PUT' ? { vps: {}, _meta: {} } : { vps: { id: 1, incident_enforcement_enabled: false, incident_warning_count: 1, incident_stop_threshold_count: 0 } };
    response.end(JSON.stringify({ status: true, response: output }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const client = createVpsAdminClient({ execute: createHaveApiExecutor(new AsyncClient(`http://127.0.0.1:${server.address().port}/mount/v7.0`)) });
    const registry = await client.incident_policy.index();
    assert.deepEqual(registry.data, rows);
    const page = await client.vps.incident_policy.index({ path: { vps_id: 1 } });
    assert.deepEqual(page.data, rows);
    assert.equal(calls.at(-1).url.pathname, '/mount/v7.0/vpses/1/incident_policies');
    assert.equal(calls.at(-1).url.search, '');
    for (const row of rows) {
      const result = await client.vps.incident_policy.show({ path: { vps_id: 1, key: row.key } });
      assert.deepEqual(result.data, row);
    }
    const params = { warning_limit_override: null, stop_limit_override: 12 };
    const updated = await client.vps.incident_policy.update({ path: { vps_id: 1, key: 'beta_policy' }, params });
    assert.equal(calls.at(-1).url.pathname, '/mount/v7.0/vpses/1/incident_policies/beta_policy');
    assert.deepEqual(calls.at(-1).body, { incident_policy: params });
    assert.deepEqual(updated.data, rows[1]);
    const ack = await client.vps.update({ path: { vps_id: 1 }, params: { incident_enforcement_enabled: false } });
    assert.deepEqual(calls.at(-1).body, { vps: { incident_enforcement_enabled: false } });
    assert.deepEqual(ack.data, {});
    assert.equal(ack.meta.action_state, undefined);
    const shared = await client.vps.show({ path: { vps_id: 1 } });
    assert.equal(shared.data.incident_enforcement_enabled, false);
    assert.equal(shared.data.incident_warning_count, 1);
    const dispatched = calls.length;
    await assert.rejects(client.vps.incident_policy.update({ path: { vps_id: 1, key: 'alpha_policy' }, params: { warning_limit_override: '5' } }), ClientInputError);
    await assert.rejects(client.vps.incident_policy.show({ path: { vps_id: 1, key: true } }), ClientInputError);
    assert.equal(calls.length, dispatched);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('invalid current configuration and saved policy history preserve nullable facts separately', async () => {
  const calls = [];
  const current = { key: 'alpha_policy', configuration_valid: false, warning_limit: null, stop_limit: null, status: null, evaluation_report_id: 3, evaluation_state: 'recorded' };
  const saved = [{ matched: true, warning_period_days: 7, stop_period_days: 30, policy_key: 'retired_policy', label: 'Saved policy', count_7d: 5, count_30d: 10, warning_limit: 5, stop_limit: 10, decision: 'stop', state: 'recorded', evaluated_at: '2026-11-15T12:00:00Z' }, { policy_key: 'skipped_policy', matched: false, warning_period_days: 7, stop_period_days: 30, state: 'audit_only' }, { policy_key: 'selection_error', matched: null, warning_period_days: 7, stop_period_days: 30, state: 'error' }, { policy_key: 'older_output' }];
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://fixture.invalid');
    calls.push(url);
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ status: true, response: url.pathname.endsWith('/policy_evaluations') ? { policy_evaluations: saved } : { incident_policy: current } }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const client = createVpsAdminClient({ execute: createHaveApiExecutor(new AsyncClient(`http://127.0.0.1:${server.address().port}/v7.0`)) });
    const row = await client.vps.incident_policy.show({ path: { vps_id: 1, key: 'alpha_policy' } });
    assert.deepEqual(row.data, current);
    const history = await client.incident_report.policy_evaluation.index({ path: { incident_report_id: 3 } });
    assert.deepEqual(history.data, saved);
    assert.deepEqual(history.data.map(({ matched }) => matched), [true, false, null, undefined]);
    assert.equal(history.data[0].warning_period_days, 7);
    assert.equal(history.data[0].stop_period_days, 30);
    assert.equal(calls.at(-1).pathname, '/v7.0/incident_reports/3/policy_evaluations');
    assert.equal(row.data.warning_limit, null, 'saved thresholds never replace invalid current configuration');
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('ordinary and aggregate report metadata preserves nullable links and every mail state', async () => {
  const reports = [{ id: 1, notice_kind: null, trigger_incident_report_id: null, notice_mail_state: null, notice_policy_key: null, notice_policy_label: null }, { id: 99 }];
  for (const [index, state] of ['pending', 'queued', 'sent', 'failed', 'uncertain', 'suppressed'].entries()) {
    reports.push({ id: index + 2, notice_kind: index % 2 ? 'stop_completed' : 'warning', trigger_incident_report_id: index === 5 ? null : 100, notice_mail_state: state, notice_policy_key: 'retired_policy', notice_policy_label: 'Saved label' });
  }
  const calls = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://fixture.invalid');
    calls.push(url);
    const match = url.pathname.match(/\/incident_reports\/(\d+)$/);
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ status: true, response: match
      ? { incident_report: reports.find(({ id }) => id === Number(match[1])) }
      : { incident_reports: reports } }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const client = createVpsAdminClient({ execute: createHaveApiExecutor(new AsyncClient(`http://127.0.0.1:${server.address().port}/v7.0`)) });
    const page = await client.incident_report.index({ params: { vps: 1 }, timeoutMs: 5000 });
    assert.deepEqual(page.data, reports);
    assert.deepEqual([...calls[0].searchParams], [['incident_report[vps]', '1']]);
    for (const report of reports) {
      const result = await client.incident_report.show({ path: { incident_report_id: report.id }, timeoutMs: 5000 });
      assert.deepEqual(result.data, report, 'notice classification and transport state are passed through independently');
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});


test('nullable Custom global setting values preserve explicit reset on the wire', async () => {
  let body;
  const server = createServer(async (request, response) => {
    let text = '';
    for await (const chunk of request) text += chunk;
    body = JSON.parse(text);
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ status: true, response: { system_config: { value: null } } }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const client = createVpsAdminClient({ execute: createHaveApiExecutor(new AsyncClient(`http://127.0.0.1:${server.address().port}/v7.0`)) });
    const result = await client.system_config.update({ path: { category: 'test', name: 'limit' }, params: { value: null }, timeoutMs: 5000 });
    assert.deepEqual(body, { system_config: { value: null } });
    assert.equal(result.data.value, null);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('system configuration choices retain scalar identity, null and absent outputs', async () => {
  const outputs = [
    { choices: [{ value: false }, { value: 0 }, { value: '' }], value_nullable: false },
    { choices: [], value_nullable: true },
    { choices: null, value_nullable: null },
    {},
  ];
  let calls = 0;
  const server = createServer((request, response) => {
    assert.equal(request.method, 'GET');
    assert.equal(request.url, '/v7.0/system_configs/core/mode');
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ status: true, response: { system_config: outputs[calls++] } }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const runtime = new AsyncClient(`http://127.0.0.1:${server.address().port}/v7.0`);
    const api = createVpsAdminClient({ execute: createHaveApiExecutor(runtime) });
    for (const output of outputs) {
      const result = await api.system_config.show({ path: { category: 'core', name: 'mode' } });
      assert.deepEqual(result.data, output);
    }
    assert.equal(calls, outputs.length);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('generic evidence reads preserve routes, null credit, measurements and Custom arrays', async () => {
  const calls = [];
  const stamp = '2026-11-25T12:00:00.123456Z';
  let credit = null;
  let unavailable = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://fixture.invalid');
    calls.push({ method: request.method, url });
    response.setHeader('Content-Type', 'application/json');
    const meta = { configuration_valid: unavailable.length === 0, unavailable_signals: unavailable, read_at: stamp };
    const row = { configuration_valid: unavailable.length === 0, credit_us: credit, peak_value: credit === null ? null : 0, peak_is_lower_bound: credit === null ? null : false, condition_value: null };
    let output;
    if (url.pathname.endsWith('/evidence_intervals')) output = {
      evidence_intervals: [{ id: 3, from_at: stamp, to_at: '2026-11-25T12:00:01.654321Z', credit_us: 1530865, measurement: null, peak_unit: null, peak_value: null, peak_is_lower_bound: null }],
      _meta: { available: true, total_count: 2, next_offset: 1, condition_measurement: 'rtnl_latency', condition_operator: 'gt', condition_value: 1000000, condition_unit: 'microseconds', window_complete: false },
    };
    else if (url.pathname.endsWith('/vps_evidence')) output = { vps_evidence: [{ ...row, credit_us: 125 }], _meta: { ...meta, total_count: 2, next_offset: 1 } };
    else output = { evidence: [row], _meta: meta };
    response.end(JSON.stringify({ status: true, response: output }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const client = createVpsAdminClient({ execute: createHaveApiExecutor(new AsyncClient(`http://127.0.0.1:${server.address().port}/mount/v7.0`)) });
    for (const value of [null, 0, 125]) {
      credit = value;
      const page = await client.vps.evidence.index({ path: { vps_id: 12 }, timeoutMs: 5000 });
      assert.equal(page.data[0].credit_us, value);
      assert.equal(page.data[0].configuration_valid, true);
      assert.equal(page.data[0].peak_value, value === null ? null : 0);
      assert.equal(page.data[0].peak_is_lower_bound, value === null ? null : false);
      assert.equal(page.data[0].condition_value, null);
      const signals = page.meta.unavailable_signals;
      assert.ok(Array.isArray(signals) && signals.every((signal) => typeof signal === 'string'));
      assert.deepEqual(signals, []);
      assert.equal(calls.at(-1).method, 'GET');
      assert.equal(calls.at(-1).url.pathname, '/mount/v7.0/vpses/12/evidence');
      assert.equal(calls.at(-1).url.search, '');
    }
    unavailable = ['rtnl_latency'];
    credit = null;
    const invalid = await client.vps.evidence.index({ path: { vps_id: 12 }, timeoutMs: 5000 });
    assert.deepEqual(invalid.meta.unavailable_signals, ['rtnl_latency']);
    assert.equal(invalid.meta.configuration_valid, false);
    assert.equal(invalid.data[0].credit_us, null);
    unavailable = [];
    const fleet = await client.vps_evidence.index({ params: { offset: 0, limit: 100, signal: 'rtnl_latency', vps: 12 }, timeoutMs: 5000 });
    assert.equal(fleet.data[0].credit_us, 125);
    assert.equal(fleet.meta.total_count, 2);
    assert.equal(fleet.meta.next_offset, 1);
    assert.equal(calls.at(-1).url.pathname, '/mount/v7.0/vps_evidence');
    assert.deepEqual([...calls.at(-1).url.searchParams].sort(), [['vps_evidence[limit]', '100'], ['vps_evidence[offset]', '0'], ['vps_evidence[signal]', 'rtnl_latency'], ['vps_evidence[vps]', '12']]);
    const saved = await client.incident_report.evidence_interval.index({ path: { incident_report_id: 12 }, params: { offset: 0, limit: 100 }, timeoutMs: 5000 });
    assert.equal(saved.data[0].from_at, stamp);
    assert.equal(saved.data[0].to_at, '2026-11-25T12:00:01.654321Z');
    assert.equal(saved.data[0].credit_us, 1530865);
    assert.equal(saved.data[0].peak_value, null);
    assert.equal(saved.meta.condition_value, 1000000);
    assert.equal(saved.meta.condition_operator, 'gt');
    assert.equal(saved.meta.window_complete, false);
    assert.equal(calls.at(-1).url.pathname, '/mount/v7.0/incident_reports/12/evidence_intervals');
    assert.deepEqual([...calls.at(-1).url.searchParams].sort(), [['evidence_interval[limit]', '100'], ['evidence_interval[offset]', '0']]);
    const before = calls.length;
    await assert.rejects(client.vps.evidence.index(), ClientInputError);
    await assert.rejects(client.vps_evidence.index({ params: { offset: '0' } }), ClientInputError);
    assert.equal(calls.length, before, 'invalid local input never dispatches');
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});


test('pressure history preserves calendar rows, nullable totals and filter requests', async () => {
  const calls = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://fixture.test');
    calls.push({ method: request.method, url });
    response.setHeader('Content-Type', 'application/json');
    if (url.pathname.endsWith('/vps_evidence')) {
      response.end(JSON.stringify({ status: true, response: { vps_evidence: [], _meta: { total_count: 0, next_offset: null } } }));
      return;
    }
    const vps = url.searchParams.get('vps_pressure_history[vps]');
    if (vps === '99') {
      response.statusCode = 403;
      response.end(JSON.stringify({ status: false, message: 'denied', errors: { vps: ['unavailable'] } }));
      return;
    }
    const days = Number(url.searchParams.get('vps_pressure_history[days]') ?? 7);
    const unavailable = vps === '13';
    const end = Date.parse('2026-11-29T00:00:00Z');
    const rows = Array.from({ length: days }, (_, index) => ({
      id: new Date(end - (days - index) * 86400000).toISOString().slice(0, 10),
      from_at: new Date(end - (days - index) * 86400000).toISOString(),
      to_at: new Date(end - (days - index - 1) * 86400000).toISOString(),
      recorded_us: !unavailable && index === days - 1 ? 125 : null,
      partial_day: index === days - 1,
    }));
    response.end(JSON.stringify({ status: true, response: {
      vps_pressure_history: rows,
      _meta: { available: !unavailable, timezone: 'UTC', read_at: '2026-11-28T12:00:00.123456Z',
        range_from: rows[0].from_at, range_to: rows.at(-1).to_at,
        total_recorded_us: unavailable ? null : 125,
        first_recorded_at: unavailable ? null : '2026-11-28T11:59:00.123456Z',
        accounting_since: unavailable ? '2026-11-27T15:00:00.123456Z' : null,
        ownership_limited: unavailable },
    } }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const runtime = new AsyncClient(`http://127.0.0.1:${server.address().port}/mount/v7.0`);
    const api = createVpsAdminClient({ execute: createHaveApiExecutor(runtime) });
    for (const days of [undefined, 30]) {
      const result = await api.vps_pressure_history.index({ params: { vps: 12, days } });
      assert.equal(calls.at(-1).method, 'GET');
      assert.equal(calls.at(-1).url.pathname, '/mount/v7.0/vps_pressure_history');
      assert.deepEqual([...calls.at(-1).url.searchParams].sort(), days === undefined
        ? [['vps_pressure_history[vps]', '12']]
        : [['vps_pressure_history[days]', '30'], ['vps_pressure_history[vps]', '12']]);
      assert.equal(result.data.length, days ?? 7);
      assert.equal(result.data[0].recorded_us, null);
      assert.equal(result.data[0].partial_day, false);
      assert.equal(result.data.at(-1).recorded_us, 125);
      assert.equal(result.data.at(-1).partial_day, true);
      assert.equal(result.data.at(-1).to_at, '2026-11-29T00:00:00.000Z');
      assert.equal(result.meta.total_recorded_us, 125);
      assert.equal(result.meta.accounting_since, null);
      assert.equal(result.meta.first_recorded_at, '2026-11-28T11:59:00.123456Z');
      assert.equal(result.meta.read_at, '2026-11-28T12:00:00.123456Z');
    }
    const unavailable = await api.vps_pressure_history.index({ params: { vps: 13 } });
    assert.equal(unavailable.meta.available, false);
    assert.ok(unavailable.data.every((row) => row.recorded_us === null));
    assert.equal(unavailable.meta.total_recorded_us, null);
    assert.equal(unavailable.meta.first_recorded_at, null);
    assert.equal(unavailable.meta.accounting_since, '2026-11-27T15:00:00.123456Z');
    assert.equal(unavailable.meta.ownership_limited, true);
    await api.vps_evidence.index({ params: { user: 1, node: 2, location: 3, environment: 4, offset: 0, limit: 25 } });
    assert.deepEqual([...calls.at(-1).url.searchParams].sort(), [
      ['vps_evidence[environment]', '4'], ['vps_evidence[limit]', '25'],
      ['vps_evidence[location]', '3'], ['vps_evidence[node]', '2'],
      ['vps_evidence[offset]', '0'], ['vps_evidence[user]', '1'],
    ]);
    await assert.rejects(api.vps_pressure_history.index({ params: { vps: 99 } }));
    const before = calls.length;
    await assert.rejects(api.vps_pressure_history.index({ params: {} }), ClientInputError);
    await assert.rejects(api.vps_pressure_history.index({ params: { vps: 12, days: '30' } }), ClientInputError);
    assert.equal(calls.length, before);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
