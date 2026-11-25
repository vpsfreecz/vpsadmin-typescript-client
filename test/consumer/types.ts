import { AsyncClient } from 'haveapi-client';
import {
  createHaveApiExecutor, createVpsAdminClient,
  type RequestExecutor, type Dataset__DisableBackupsInput,
} from 'vpsadmin-typescript-client';

const runtime = new AsyncClient('https://api.example.test/v7.0');
const execute: RequestExecutor = createHaveApiExecutor(runtime);
const client = createVpsAdminClient({ execute });
const disableInput: Dataset__DisableBackupsInput = { backup_first: false, recursive: true };
const disableResult = await client.dataset.disable_backups({ path: { dataset_id: 7 }, params: disableInput });
const cleanupReceipt: number | null | undefined = disableResult.meta.action_state_id;
// @ts-expect-error explicit backup opt-out must be a boolean
client.dataset.disable_backups({ path: { dataset_id: 7 }, params: { backup_first: 'false' } });
// @ts-expect-error there is no caller continuation parameter
client.dataset.disable_backups({ path: { dataset_id: 7 }, params: { preservation_chain: 41 } });
void cleanupReceipt;
const config = await client.system_config.show({ path: { category: 'core', name: 'mode' } });
const valueNullable: boolean | null | undefined = config.data.value_nullable;
const choices: unknown = config.data.choices;
// @ts-expect-error nullable Boolean output must retain its Boolean type
const invalidNullable: string = config.data.value_nullable;
void [valueNullable, choices, invalidNullable];
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


// Runtime string keys select generic policy resources; configured keys are not enums.
const key: string = 'another_policy';
const registry = await client.incident_policy.index();
const declared = await client.incident_policy.show({ path: { key } });
const policies = await client.vps.incident_policy.index({ path: { vps_id: 1 } });
const current = await client.vps.incident_policy.show({ path: { vps_id: 1, key } });
const updated = await client.vps.incident_policy.update({
  path: { vps_id: 1, key },
  params: { warning_limit_override: null, stop_limit_override: 12 },
});
const shared = await client.vps.show({ path: { vps_id: 1 } });
client.vps.update({ path: { vps_id: 1 }, params: { incident_enforcement_enabled: false } });
client.vps.index({ params: { incident_policy: key, incident_status: 'near_limit' } });
const labels: (string | null | undefined)[] = [declared.data.key, declared.data.label, current.data.description, current.data.global_mode, current.data.effective_mode, current.data.status];
const counts: (number | null | undefined)[] = [current.data.count_7d, current.data.count_30d, current.data.warning_limit, current.data.stop_limit, current.data.warning_limit_override, current.data.stop_limit_override, shared.data.incident_warning_count, shared.data.incident_stop_threshold_count];
const flags: (boolean | null | undefined)[] = [current.data.configuration_valid, current.data.stop_enforced, shared.data.incident_enforcement_enabled];
const historical = await client.incident_report.policy_evaluation.index({ path: { incident_report_id: 3 } });
const evaluation = historical.data[0];
const savedTime: string | null | undefined = evaluation?.evaluated_at;
const savedKey: string | null | undefined = evaluation?.policy_key;
const matched: boolean | null | undefined = evaluation?.matched;
const warningDays: number | null | undefined = evaluation?.warning_period_days;
const stopDays: number | null | undefined = evaluation?.stop_period_days;
// @ts-expect-error unavailable membership cannot be treated as false
const knownMembership: boolean = evaluation?.matched;
// @ts-expect-error source admission metadata is absent from reusable policies
const oldRegistrySource = declared.data.source_type;
// @ts-expect-error current VPS policy rows do not declare a source type
const oldPolicySource = current.data.source_type;
const samePolicyOutput: typeof current.data | undefined = policies.data[0];
const authoritativeUpdate: typeof current.data = updated.data;
void [registry, labels, counts, flags, savedTime, savedKey, matched, warningDays, stopDays, knownMembership, oldRegistrySource, oldPolicySource, samePolicyOutput, authoritativeUpdate];
// @ts-expect-error generic path scalars reject booleans
client.vps.incident_policy.show({ path: { vps_id: 1, key: true } });
// @ts-expect-error enforcement is a non-null shared VPS boolean
client.vps.update({ path: { vps_id: 1 }, params: { incident_enforcement_enabled: null } });
// @ts-expect-error override fields retain numeric types
client.vps.incident_policy.update({ path: { vps_id: 1, key }, params: { warning_limit_override: '5' } });
// @ts-expect-error overrides no longer belong to the shared VPS Update
client.vps.update({ path: { vps_id: 1 }, params: { incident_warning_limit_override: 5 } });
// @ts-expect-error policy configuration cannot reset shared permission
client.vps.incident_policy.update({ path: { vps_id: 1, key }, params: { incident_enforcement_enabled: false } });
// @ts-expect-error obsolete flat summary fields are absent
const oldLimit = shared.data.incident_warning_limit;
// @ts-expect-error nullable current limits cannot be treated as known thresholds
const knownLimit: number = current.data.warning_limit;
// @ts-expect-error output-only counters cannot be updated
client.vps.update({ path: { vps_id: 1 }, params: { incident_warning_count: 5 } });
const reportPage = await client.incident_report.index({ params: { vps: 1, policy_key: key } });
const reportDetail = await client.incident_report.show({ path: { incident_report_id: 1 } });
const report = reportDetail.data;
const noticeKind: string | null | undefined = report.notice_kind;
const triggerId: number | null | undefined = report.trigger_incident_report_id;
const mailState: string | null | undefined = report.notice_mail_state;
const noticeKey: string | null | undefined = report.notice_policy_key;
const noticeLabel: string | null | undefined = report.notice_policy_label;
// @ts-expect-error notice policy identity is output-only
client.incident_report.create({ params: { notice_policy_key: key } });
void [reportPage, noticeKind, triggerId, mailState, noticeKey, noticeLabel, oldLimit, knownLimit];
// @ts-expect-error historical trigger is a raw integer, not a live resource object
const wrongTrigger: { id: number } = report.trigger_incident_report_id;
// @ts-expect-error report classification is read-only
client.incident_report.create({ params: { notice_kind: 'warning' } });
void wrongTrigger;

// Nullable global overrides use the described Custom value input.
client.system_config.update({ path: { category: 'test', name: 'limit' }, params: { value: null } });


const intervals = await client.incident_report.evidence_interval.index({
  path: { incident_report_id: 3 }, params: { offset: 0, limit: 100 },
});
const intervalFrom: string | null | undefined = intervals.data[0]?.from_at;
const intervalCredit: number | null | undefined = intervals.data[0]?.credit_us;
const lowerBound: boolean | null | undefined = intervals.data[0]?.peak_is_lower_bound;
const condition: number | null | undefined = intervals.meta.condition_value;
const complete: boolean | null | undefined = intervals.meta.window_complete;
const live = await client.vps.evidence.index({ path: { vps_id: 12 } });
const fleet = await client.vps_evidence.index({ params: { offset: 0, limit: 100, signal: 'rtnl_latency', vps: 12 } });
const currentCredit: number | null | undefined = live.data[0]?.credit_us;
const peak: number | null | undefined = fleet.data[0]?.peak_value;
const nextOffset: number | null | undefined = fleet.meta.next_offset;
const unavailable: unknown = fleet.meta.unavailable_signals;
if (Array.isArray(unavailable) && unavailable.every((signal) => typeof signal === 'string')) {
  const signals: string[] = unavailable;
  void signals;
}
// @ts-expect-error Custom output has no declared array element subtype
const uncheckedSignals: string[] = fleet.meta.unavailable_signals;
// @ts-expect-error unavailable ownership credit cannot be treated as recorded zero
const knownCredit: number = live.data[0]?.credit_us;
// @ts-expect-error optional measurements retain nullable types
const knownPeak: number = fleet.data[0]?.peak_value;
// @ts-expect-error required parent report path
client.incident_report.evidence_interval.index();
// @ts-expect-error required parent VPS path
client.vps.evidence.index();
// @ts-expect-error obsolete draft child is absent
client.incident_report.rtnl_interval.index({ path: { incident_report_id: 3 } });
// @ts-expect-error pagination inputs remain integers
client.vps_evidence.index({ params: { offset: '0' } });
// @ts-expect-error unknown completeness differs from false
const knownComplete: boolean = intervals.meta.window_complete;
void [intervalFrom, intervalCredit, lowerBound, condition, complete, currentCredit, peak, nextOffset, uncheckedSignals, knownCredit, knownPeak, knownComplete];

// Additive SystemConfig fields retain nullable booleans and unknown Custom data.
const setting = await client.system_config.show({ path: { category: 'test', name: 'limit' } });
const settingNullable: boolean | null | undefined = setting.data.value_nullable;
const settingChoices: unknown = setting.data.choices;
// @ts-expect-error optional and nullable configuration state is not a known boolean
const knownNullable: boolean = setting.data.value_nullable;
// @ts-expect-error Custom choices do not declare a string-array subtype
const knownChoices: string[] = setting.data.choices;
void [settingNullable, settingChoices, knownNullable, knownChoices];


const pressure = await client.vps_pressure_history.index({ params: { vps: 12, days: 30 } });
client.vps_pressure_history.index({ params: { vps: 12 } });
client.vps_evidence.index({ params: { user: 1, node: 2, location: 3, environment: 4 } });
const dailyRecorded: number | null | undefined = pressure.data[0]?.recorded_us;
const historyTotal: number | null | undefined = pressure.meta.total_recorded_us;
const currentEpoch: string | null | undefined = pressure.meta.accounting_since;
const firstAcceptance: string | null | undefined = pressure.meta.first_recorded_at;
// @ts-expect-error unknown daily duration cannot be treated as measured zero
const knownDaily: number = pressure.data[0]?.recorded_us;
// @ts-expect-error history requires a VPS input
client.vps_pressure_history.index({ params: { days: 7 } });
// @ts-expect-error periods are integer inputs, not strings
client.vps_pressure_history.index({ params: { vps: 12, days: '30' } });
// @ts-expect-error resource filters use numeric identities
client.vps_evidence.index({ params: { node: '2' } });
void [dailyRecorded, historyTotal, currentEpoch, firstAcceptance, knownDaily];
