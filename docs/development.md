# Development and regeneration

Run these commands from the repository root unless a step names another
checkout. For application examples, see the [README](../README.md).

## Development and verification

Enter the pinned development shell and install the locked dependencies:

```sh
nix develop
npm ci --ignore-scripts --no-audit --no-fund
```

`flake.lock` pins the Nix tools. `tools/toolchain.json` records Node.js 24.21.0,
npm 11.19.0, Ruby 3.4.11, TypeScript 6.0.3 and Prettier 3.9.10.
`package-lock.json` records the npm dependency graph. Ruby runs the source
generator using its standard library; applications using the built package do
not need Ruby or Prettier. The pinned developer Node version does not impose a
Node 24 requirement on consumers.

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
consumer and checks ESM imports, strict TypeScript declarations and local
executor reads and writes. Its invalid-call cases must continue to fail
type checking. These checks use local executors and do not call a running API.

## Schema and regeneration

Generated source has separate modules for resources and actions. For example,
`src/generated/resources/vps/resource.ts` composes the VPS resource, and
`src/generated/resources/vps/actions/index.ts` contains its Index action.
Child resources have nested `resources/` directories. The root `api.ts` composes
the client, and `types.ts` re-exports public types. Browse these modules for an
operation's implementation and declarations.

Applications import from `vpsadmin-typescript-client`. Individual generated
module paths are internal and are not package subpath exports.

The saved schema covers 156 application resources and 529 actions. One
authentication resource and five authentication actions are retained and validated
in the snapshot, counted separately, and excluded from generation. This is the
complete declared fixture capture, including all six configured plugins; a
permission-filtered live description is not a replacement. Check compatibility
before using the generated package with another API release.

Follow vpsAdmin's [generated-client synchronization procedure](https://github.com/vpsfreecz/vpsadmin/blob/master/docs/api-schema-export.md#generated-client-synchronization)
when API contracts or generator output change. It covers the Go, Rust and
TypeScript clients and the evidence needed to finish synchronization. This
repository's offline checks verify the saved inputs and generated output;
they do not establish freshness against the current vpsAdmin API source.

Use `incident_policy.index` to discover policies and `vps.incident_policy.index`
or `vps.incident_policy.show` to read their current rows for a VPS. Policy keys
come from the registry at runtime; the generated client does not enumerate a
site's configured policies. The path encoder accepts string and numeric scalar
segments. Pass the registry's string key when addressing a policy.

Update limits through `vps.incident_policy.update` with the VPS ID and policy
key. Explicit null clears an override so the limit is inherited. This synchronous
update returns the authoritative policy row. Change shared shutdown permission
in a separate VPS update, then read the VPS to confirm its current value.

Current policy rows include counts, limits, overrides and `configuration_valid`,
even before any incident matches. Limits reflect the declaration and current
overrides. Invalid configurations have null effective limits and status.
Evaluation IDs, timestamps, states and nested incident-report policy evaluations
describe saved history. They do not supply current limits or predict whether a
policy will match a future event. Timestamps remain wire strings. Check the
server's capabilities before enabling these calls. Optional output values remain
absent or null when the server supplies no fact.

Saved evaluations include nullable `matched` and the count-window lengths
`warning_period_days` and `stop_period_days`. Keep `true`, `false`, `null` and
missing membership distinct. A report's `notice_policy_key` and
`notice_policy_label` identify its saved originating policy and can be null
or absent. They do not select a current policy. Active registry and VPS policy
metadata have no `source_type` field.

Incident reports expose nullable notice kind, triggering report ID and mail
state. Ordinary reports return null for all three. Notice kind distinguishes a
warning from a confirmed stop. The triggering report ID is an integer and may
be unavailable. Mail state `pending` means the notice has not been queued.
`queued` does not establish SMTP success; `sent` means SMTP succeeded, without
proving delivery to the recipient's inbox.

Administrators can use `incident_policy_exposure.index` for current VPS/policy
matches and `incident_policy_evaluation.index` for saved evaluations with
current action and mail outcomes. Both take `offset` and `limit`. Their global
response metadata includes `total_count`, `offset`, `limit`, `next_offset`,
`as_of` and `read_at`; History also returns `from` and `to`. Keep the returned
`as_of` when requesting another page. It fixes the counting and recording
cutoff, while settings, ownership and outcomes reflect each read. History
orders by evaluation time and ID and accepts `direction`, with no `sort` input.

Exposure returns ordinary partial Resource references for `vps`, `user` and
`node`. Their generated `id` and label values have type `unknown`; check their
primitive types before displaying them or building links. Preserve absent and
null values, including `matched` and `next_offset`, instead of replacing them
with false or zero.

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

`tools/regenerate` selects Prettier 3.9.10 from this repository's installed npm
dependencies and ignores an inherited `PRETTIER` value. It uses the configuration
packaged with the pinned HaveAPI generator, without reading application
formatting configuration. Regeneration installs no tools. The ownership manifest
records the formatter version, configuration SHA256 and hashes of the formatted
output files.

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
a separately authorized release. The package uses the MIT license and retains
the exact `haveapi-client` 0.32.0 peer dependency.

See [release preparation](releasing.md) for build-only workflow checks,
trusted-publisher setup prerequisites and the retained-archive publication path.
