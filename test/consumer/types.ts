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
const total: number | null | undefined = result.meta.total_count;
const extension: unknown = result.meta.extension;
// @ts-expect-error declared metadata retains its numeric type
const invalidTotal: string = result.meta.total_count;
void [total, extension, invalidTotal];

const description = await client.network.update.describe({ path: { network_id: 1 } });
const required: boolean | null | undefined = description.data.input?.parameters?.['label']?.required;
void required;
client.describe({ timeoutMs: 1000 });
// @ts-expect-error action description requires its path placeholders
client.network.update.describe();
// @ts-expect-error live descriptions do not accept mutation input
client.network.update.describe({ path: { network_id: 1 }, params: { label: 'test' } });
// @ts-expect-error API root description cannot select an arbitrary route
client.describe({ path: '/untrusted' });
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

const advisoryPath = { security_advisory_id: 1 };
const guardedDraft = { expected_content_revision: 0, expected_state: 'draft' };
client.security_advisory.update({ path: advisoryPath, params: guardedDraft });
client.security_advisory_cve.create({ params: { ...guardedDraft, security_advisory: 1, cve_id: 'CVE-2026-12345' } });
client.security_advisory_cve.update({ path: { security_advisory_cve_id: 2 }, params: guardedDraft });
client.security_advisory_cve.delete({ path: { security_advisory_cve_id: 2 }, params: guardedDraft });
client.security_advisory.node_status.create({ path: advisoryPath, params: { ...guardedDraft, node: 3, state: 'unknown' } });
client.security_advisory.node_status.update({ path: { ...advisoryPath, node_status_id: 4 }, params: guardedDraft });
client.security_advisory.node_status.delete({ path: { ...advisoryPath, node_status_id: 4 }, params: guardedDraft });
client.security_advisory.retract({ path: advisoryPath, params: { expected_content_revision: 1, expected_state: 'published' } });
client.security_advisory.delete({ path: advisoryPath, params: guardedDraft });
// @ts-expect-error advisory deletion requires a reviewed content revision
client.security_advisory.delete({ path: advisoryPath, params: { expected_state: 'draft' } });
// @ts-expect-error a state precondition cannot be null
client.security_advisory.retract({ path: advisoryPath, params: { expected_content_revision: 1, expected_state: null } });

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
