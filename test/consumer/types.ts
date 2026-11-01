import { AsyncClient } from 'haveapi-client';
import {
  createHaveApiExecutor, createVpsAdminClient,
  ClientInputError, type ApiDescription, type ActionDescription,
  type RequestExecutor,
} from 'vpsadmin-typescript-client';

const runtime = new AsyncClient('https://api.example.test/v7.0');
const execute: RequestExecutor = createHaveApiExecutor(runtime);
const client = createVpsAdminClient({ execute });
const result = await client.network.index({
  params: { limit: 10, enabled: false, location: 1 },
  meta: { count: true, includes: 'primary_location' },
  signal: new AbortController().signal,
});
const first = result.data[0];
const totalCount: number | null | undefined = result.meta.total_count;
const extraMetadata: unknown = result.meta['future_server_metadata'];
void [totalCount, extraMetadata];
if (first) {
  const label: string | null | undefined = first.label;
  const location = first.primary_location;
  if (location) {
    const id: unknown = location.id;
    void id;
  }
  // @ts-expect-error authorization may filter a field, and outputs can be null
  const requiredLabel: string = first.label;
  void [label, requiredLabel];
}

client.network.index();
client.network.show({ path: { network_id: '1' } });
client.network.update({ path: { network_id: 1 }, params: { label: '', enabled: false, prefix: 0 } });

const apiDescription: ApiDescription = (await client.describe({ timeoutMs: 50 })).data;
const actionDescription: ActionDescription = (await client.network.update.describe({
  path: { network_id: 1 }, signal: new AbortController().signal,
})).data;
void [apiDescription, actionDescription];
const vpsPage = await client.vps.index({
  params: { limit: 100, from_id: 0 }, meta: { includes: 'node,user', count: true },
});
const vpsCount: number | null | undefined = vpsPage.meta.total_count;
const started = await client.vps.start({ path: { vps_id: 7 } });
const pendingState: unknown = started.meta['action_state'];
const nodeUpdate = await client.node.update.describe({ path: { node_id: 1 } });
void [vpsCount, pendingState, nodeUpdate.data.input];
const configuredClient = createVpsAdminClient({ execute, metaNamespace: '_wire' });
const configuredPage = await configuredClient.network.index({ meta: { count: true } });
const resolved: boolean | null | undefined = configuredPage.data[0]?._meta?.resolved;
void resolved;
// @ts-expect-error metadata namespace configuration requires a string
createVpsAdminClient({ execute, metaNamespace: 7 });
try {
  await client.network.show({ path: { network_id: Number.MAX_SAFE_INTEGER + 1 } });
} catch (error) {
  if (error instanceof ClientInputError) {
    const code: 'HAVEAPI_CLIENT_INPUT_ERROR' = error.code;
    const phase: 'pre-dispatch' = error.phase;
    void [code, phase];
  }
}

// @ts-expect-error an action description still requires its concrete path
client.network.update.describe();
// @ts-expect-error description probes do not accept mutation parameters
client.network.update.describe({ path: { network_id: 1 }, params: { label: 'test' } });
// @ts-expect-error root descriptions do not accept arbitrary HTTP paths
client.describe({ path: '/users' });
// @ts-expect-error known global output metadata retains its declared type
const invalidTotalCount: string = result.meta.total_count;
void invalidTotalCount;

// @ts-expect-error resource names come from the saved schema
client.missing.index();
// @ts-expect-error action names come from the saved schema
client.network.missing();
// @ts-expect-error output fields are not index filters
client.network.index({ params: { address: '192.0.2.0' } });
// @ts-expect-error integer filters do not accept strings
client.network.index({ params: { limit: '10' } });
// @ts-expect-error paths are required for writes
client.network.update({ params: { label: 'test' } });
// @ts-expect-error path IDs do not accept booleans
client.network.show({ path: { network_id: true } });
// @ts-expect-error the real schema marks label as non-nullable input
client.network.update({ path: { network_id: 1 }, params: { label: null } });
// @ts-expect-error the runtime cannot encode structured Custom query metadata
client.network.index({ meta: { includes: ['primary_location'] } });
// @ts-expect-error authentication routes remain owned by the HaveAPI runtime
client.authentication.token.request();
