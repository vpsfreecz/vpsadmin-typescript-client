import { AsyncClient } from 'haveapi-client';
import {
  createHaveApiExecutor, createVpsAdminClient,
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
