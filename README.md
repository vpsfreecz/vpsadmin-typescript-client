# vpsAdmin TypeScript client

Generated operations and types for vpsAdmin API 7.0, provided as an ESM package
with ES2022 JavaScript and TypeScript declarations. HaveAPI handles HTTP,
authentication and response envelopes; applications keep their permission checks
and write recovery policy.

## Installation

Install the package from npm:

```sh
npm install vpsadmin-typescript-client@0.2.0
```

To build a local tarball from a source checkout of this SDK:

```sh
nix develop
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm pack --ignore-scripts
```

Then install the resulting tarball in your application:

```sh
npm install /path/to/vpsadmin-typescript-client-*.tgz
```

npm installs the declared `haveapi-client` peer dependency normally. Use an ESM
application, with `"type": "module"` in its `package.json`. The examples below use
TypeScript in Node.js.

The package is licensed under the [MIT License](LICENSE).

## Usage

Set `VPSADMIN_TOKEN` in your environment to an existing HaveAPI token. This
complete program reads the first page of up to 50 VPSes visible to that token
and prints their ID, hostname and running state:

```ts
import { AsyncClient } from 'haveapi-client';
import {
  createHaveApiExecutor,
  createVpsAdminClient,
} from 'vpsadmin-typescript-client';

const token = process.env.VPSADMIN_TOKEN?.trim();
if (!token) {
  throw new Error('Set VPSADMIN_TOKEN to an existing API token.');
}

const runtime = new AsyncClient('https://api.vpsfree.cz/v7.0');
await runtime.authenticate('token', { token });
const api = createVpsAdminClient({ execute: createHaveApiExecutor(runtime) });

const page = await api.vps.index({
  params: { limit: 50 },
  timeoutMs: 30_000,
});

for (const vps of page.data) {
  const running = vps.is_running == null
    ? 'unknown'
    : vps.is_running ? 'running' : 'stopped';
  console.log(vps.id ?? 'unknown', vps.hostname ?? '(unknown hostname)', running);
}
```

The runtime's base URL must include the API version and any mount prefix. For a
mounted deployment, use a URL such as `https://api.example.test/api/v7.0`.
Generated paths such as `/vpses` are relative to that versioned base. The adapter
preserves the runtime's receiver and calls its `request` method.

## Working with VPSes

The following snippets use the authenticated `api` from the usage example.
Choose a location and OS template, create a VPS, then use its returned ID to
inspect and manage it. Choose one creation example and only the power action
you need.

### Choose a location and OS template

List locations where you can create a VPS:

```ts
const locations = await api.location.index({
  params: { has_hypervisor: true },
  timeoutMs: 30_000,
});
for (const location of locations.data) {
  console.log(location.id ?? 'unknown', location.label ?? '(unknown location)',
    location.has_ipv6 ?? 'unknown');
}
```

Choose a location from those results. The following snippets use `locationId`,
a numeric ID supplied by your application after that choice. Use a location with
a returned ID. List templates available at the chosen location:

```ts
const templates = await api.os_template.index({
  params: { location: locationId },
  timeoutMs: 30_000,
});
for (const template of templates.data) {
  console.log(template.id ?? 'unknown', template.label ?? '(unknown template)');
}
```

Choose a compatible template from those results and supply its numeric ID as
`templateId`. The creation examples below assume your application has selected
both `locationId` and `templateId`.

### Create a VPS

To create a VPS, choose a hostname, location and OS template. The minimal
request creates `my-vps`:

```ts
const created = await api.vps.create({
  params: {
    hostname: 'my-vps',
    location: locationId,
    os_template: templateId,
  },
  timeoutMs: 30_000,
});
```

The VPS starts by default. Omitted resource sizes use the API's defaults. By
default it receives one IPv4 and one IPv6 allocation where IPv6 is available.

To choose resource sizes and public IP allocation counts, use this alternative
creation request:

```ts
const created = await api.vps.create({
  params: {
    hostname: 'my-vps',
    location: locationId,
    os_template: templateId,
    cpu: 2,
    memory: 2048,
    diskspace: 10240,
    ipv4: 1,
    ipv6: 1,
  },
  timeoutMs: 30_000,
});
```

Memory and disk space use MiB: `2048` is 2 GiB and `10240` is 10 GiB. `cpu` sets
CPU capacity. Requested resources must fit your quota and be available at the
chosen location.

The `ipv4` and `ipv6` values are allocation counts, not addresses. An allocation
can be an individual address or a routed prefix. IPv6 requires support at the
chosen location.

After either creation call, check that its output contains a VPS ID before
using it in the following examples:

```ts
const vpsId = created.data.id;
if (vpsId == null) {
  throw new Error('Create response did not include a VPS ID.');
}
```

Creating a VPS starts background work. Before continuing, check that creation
has completed successfully. A returned VPS ID or an unfinished operation does
not establish completion. Check completion again before each dependent action;
the same rule applies to power controls and deletion. The generated facade does
not wait automatically; use your application's action-state handling. Raw
receipts cannot be passed to `AsyncClient.waitForCompletion`.

### Inspect and rename the VPS

Once creation has completed successfully, inspect the returned `vpsId`:

```ts
const inspected = await api.vps.show({
  path: { vps_id: vpsId },
  timeoutMs: 30_000,
});
console.log(inspected.data.hostname ?? '(unknown hostname)');
```

To rename that VPS to `new-hostname`, send only the hostname input:

```ts
await api.vps.update({
  path: { vps_id: vpsId },
  params: { hostname: 'new-hostname' },
  timeoutMs: 30_000,
});
```

### Start, stop or restart

Each action uses the same `vpsId`. Run the operation you need as a separate
request, then check its completion before depending on the resulting state.

Start a stopped VPS. Creation already starts the VPS by default:

```ts
await api.vps.start({
  path: { vps_id: vpsId },
  timeoutMs: 30_000,
});
```

Request a graceful stop:

```ts
await api.vps.stop({
  path: { vps_id: vpsId },
  timeoutMs: 30_000,
});
```

Or request a graceful restart:

```ts
await api.vps.restart({
  path: { vps_id: vpsId },
  timeoutMs: 30_000,
});
```

### Delete the VPS

When you no longer need the VPS, request deletion using its returned ID:

```ts
await api.vps.delete({
  path: { vps_id: vpsId },
  timeoutMs: 30_000,
});
```

Deletion schedules the VPS to stop and its IP allocations to be released.
Disk data is removed later.

## Authentication

Authenticate the HaveAPI runtime before calling generated operations. The usage
example supplies an existing token. For Basic authentication and token login, see
[HaveAPI async client documentation](https://github.com/vpsfreecz/haveapi/blob/master/clients/js/doc-async-client.md).
The generated facade does not initialize authentication or discover permissions.
An operation's presence in the generated API does not grant access to it.

Applications with an established transport adapter can supply it as `execute`.
It accepts HaveAPI's `RequestSpec` and returns
`Promise<RequestResult<unknown>>`.

## Responses, errors and timeouts

Read `data` for the action-specific output. Responses also retain `meta`, the
full `envelope` and `httpStatus`.

Use `params.limit` and `params.from_id` for VPS pagination. `from_id` selects
VPS IDs greater than the supplied ID. Metadata can include `total_count` when
`meta: { count: true }` is requested. The SDK does not paginate automatically.

Output fields can be absent or null because authorization filters them and the
API can return null. Keep the fallbacks shown above to distinguish a missing
running state from a stopped VPS. Associations are partial references, Custom
output remains `unknown`, and datetimes remain wire-format strings. Generated
types do not validate server responses.

Handle request and validation failures with `try`/`catch` around awaited calls.
Request headers, `AbortSignal` and `timeoutMs` pass through to the executor. Some
actions start background work. A successful response does not mean that work
has finished; generated methods do not wait for completion. Raw request receipts
do not satisfy `AsyncClient.waitForCompletion`'s invocation contract. A timeout
or cancellation does not prove a write failed. Inspect the server's state before
retrying an uncertain write. Generated methods do not retry writes automatically.

Omitted and `undefined` inputs are omitted from requests. Supported explicit
nulls, `false`, zero and empty strings are preserved. Integer inputs and numeric
path IDs must be safe JavaScript integers; string path IDs are encoded as path
segments. The client cannot recover integer precision already lost when parsing
a response. Custom JSON body input supports recursive JSON values, while Custom
query input, including `meta.includes`, accepts scalar values. Use the API's
supported string form for association includes.

## Development and regeneration

See the [development guide](docs/development.md) for pinned tools, verification,
the saved schema and provenance, VPS resource modules, and offline regeneration.
Applications import from `vpsadmin-typescript-client`; individual generated module
paths are internal and are not package subpath exports.

See [release preparation](docs/releasing.md) for build-only workflow checks,
trusted-publisher setup prerequisites and the retained-archive publication path.
