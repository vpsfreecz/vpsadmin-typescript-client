# vpsAdmin TypeScript client

This package provides generated operations and types for the recorded vpsAdmin
API 7.0 schema. It uses an injected request executor. HaveAPI handles HTTP,
authentication and response envelopes; the application keeps its authentication,
permission checks and write recovery policy.

The package is ESM, with ES2022 JavaScript and TypeScript declarations. It requires
`haveapi-client` exactly `0.30.2`. Development version `0.0.0` is private and has
not been published.

## Using the client

Configure the existing HaveAPI runtime with the complete, versioned API URL:

```ts
import { AsyncClient } from 'haveapi-client';
import {
  createHaveApiExecutor,
  createVpsAdminClient,
} from 'vpsadmin-typescript-client';

const runtime = new AsyncClient('https://api.example.test/v7.0');
const api = createVpsAdminClient({ execute: createHaveApiExecutor(runtime) });

const result = await api.network.index({
  params: { limit: 50, enabled: true },
  meta: { count: true },
});

for (const network of result.data) {
  console.log(network.id, network.address);
}
```

For a deployment below a mount prefix, use a URL such as
`https://api.example.test/api/v7.0`. The executor receives paths such as
`/networks`; the version prefix belongs in the runtime's base URL. Setting
`{ version: '7.0' }` on an unversioned runtime does not version its raw `request`
calls. The adapter preserves the runtime's receiver and calls only `request`.

Applications with an established transport adapter can supply it as `execute`.
The executor accepts HaveAPI's `RequestSpec` and returns
`Promise<RequestResult<unknown>>`. Generated methods preserve metadata, the full
envelope and HTTP status while assigning the action-specific type to `data`.
Request headers, `AbortSignal` and `timeoutMs` pass through to the executor.

Writes use named path parameters and action-specific input:

```ts
await api.network.update({
  path: { network_id: 123 },
  params: { label: 'Private network', enabled: false },
});
```

Valid calls perform one executor request. Generated methods do not retry writes, discover
permissions, initialize authentication, wait for blocking actions or fetch
associations. Keep those decisions in the application. Raw request receipts do
not satisfy `AsyncClient.waitForCompletion`'s invocation contract.

## Type and runtime limits

Method names and input fields come from the saved schema. Output fields are
optional and nullable because authorization can filter them and the API can
return null. Associations contain partial references; Custom output remains
`unknown`. Validate application data before relying on it. Generated types do
not validate server responses or grant access to an operation.

Omitted and `undefined` inputs are omitted from requests. Explicit supported
nulls, `false`, zero and empty strings are preserved. Integer inputs and numeric
path IDs must be safe JavaScript integers. String path IDs are encoded as path
segments. The client cannot recover integer precision already lost while parsing
a server response. Datetimes remain wire-format strings.

Custom JSON body input supports recursive JSON values. Custom query input,
including `meta.includes`, accepts scalar values because HaveAPI 0.30.2 cannot
encode structured query values safely. Use the API's supported string form for
association includes.

Authentication descriptions are retained and validated in the snapshot. Their
API-root operations remain with the HaveAPI runtime. The generated client covers
151 application resources and 519 actions; one authentication resource and five
authentication actions are counted separately and excluded from generation. It
targets this schema and API version; check compatibility before using it with
another API release. Older browser bundles can remain active during a rollout.

## Development and verification

Enter the pinned development shell and install the locked dependencies:

```sh
nix develop
npm ci --ignore-scripts --no-audit --no-fund
```

`flake.lock` pins the Nix tools. `tools/toolchain.json` records Node.js 24.21.0,
npm 11.19.0, Ruby 3.4.11 and TypeScript 6.0.3. `package-lock.json` records the npm
dependency graph. Ruby runs the source generator using its standard library;
applications using the built package do not need Ruby. The pinned developer
Node version does not impose a Node 24 requirement on consumers.

Build and check the package:

```sh
npm run build
npm run typecheck
npm run typecheck:consumer
npm test
npm run test:package
```

The build writes JavaScript and declarations to ignored `dist/`. The package
check creates an npm archive, checks its contents, extracts it into a disposable
consumer and checks ESM imports, strict TypeScript declarations and Network
read and write executor behavior. Its invalid-call cases must continue to fail
type checking. These checks use local executors and do not call a running API.

## Schema and regeneration

Generated source has separate modules for resources and actions. For example,
`src/generated/resources/network/resource.ts` composes the Network resource, and
`src/generated/resources/network/actions/index.ts` contains its Index action.
Child resources have nested `resources/` directories. The root `api.ts` composes
the client, and `types.ts` re-exports public types. Browse these modules for an
operation's implementation and declarations.

Applications import from `vpsadmin-typescript-client`. Individual generated
module paths are internal and are not package subpath exports.

The committed inputs are:

- `schema/schema.json`: canonical API 7.0/protocol 2.0 mounted-source snapshot,
  profile `vpsadmin-full-fixture`, with the declared six plugins.
- `schema/provenance.json`: source, fixture, plugin, schema and tooling identity.
- `schema/tooling.Gemfile.lock`: the exporter dependency graph bound by provenance.
- `tools/generator.json`: the exact HaveAPI generator revision, source digest,
  schema and provenance hashes, and package tooling hashes.

The snapshot's `https://schema.invalid/v7.0/` URL identifies its source context.
Regeneration does not contact that URL or a running API. To regenerate, supply a
local HaveAPI checkout at the exact revision recorded in `tools/generator.json`:

```sh
nix develop
./tools/regenerate --haveapi-source /path/to/haveapi
./tools/regenerate --haveapi-source /path/to/haveapi --check
```

The command verifies the source revision, generator source digest, root `VERSION`,
saved inputs and tooling hashes. It refuses dirty or untracked generator source.
Offline regeneration explicitly loads both `clients/ruby/lib` and
`clients/typescript/lib` from that checkout. It verifies the shared schema library
and Ruby-client version came from that checkout and match the recorded source
identity. Regeneration runs offline without installing HTTP dependencies.
`--check` compares the generated tree without writing it. Regeneration owns only
`src/generated/`; keep handwritten package code outside that directory. Its
`.haveapi-generated.json` manifest records owned file hashes and separate
application and authentication coverage. Commit generated source and input records;
keep build output untracked.

The shared-source refusal checks use a disposable local clone of that exact
checkout and leave the generated tree unchanged:

```sh
HAVEAPI_SOURCE=/path/to/haveapi node --test test/regeneration/sources.test.mjs
```

To update the API schema, use vpsAdmin's controlled exporter. It captures the full
declared API and plugin profile; a permission-filtered live description is
insufficient for this package. From a clean, committed vpsAdmin checkout:

```sh
nix develop .#vpsadmin
tools/export-api-schema --prepare
tools/export-api-schema --api-version 7.0 --output /tmp/vpsadmin-schema-review
```

Choose a fresh output directory. Review its `schema.json`, `provenance.json` and
`tooling.Gemfile.lock`, including plugin coverage and source and tooling identity,
before updating this repository's saved inputs and generator pins and regenerating.
The exporter writes review candidates to the chosen directory. See vpsAdmin's
`docs/api-schema-export.md` for its environment and cleanup requirements.

The npm archive includes built output, schema, provenance, exporter lock, and
generator identity and coverage records. Regeneration commands and the pinned
development environment remain in this source repository. Publication requires
a separately authorized release and removal of the package's private flag.

See [release preparation](docs/releasing.md) for build-only workflow checks,
trusted-publisher setup prerequisites and the retained-archive publication path.
