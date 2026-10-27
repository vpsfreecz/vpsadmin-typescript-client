# Package validation and npm releases

Version `0.1.0` is prepared for public npm distribution under the MIT license.
The maintainer publishes the first release manually from a validated archive.
The release workflow remains available for build-only validation;
automated publication requires the separate setup and approval described below.

## Build-only validation

`.github/workflows/release.yml` validates branch pushes, pull requests and manual
dispatches. It uses the committed Nix toolchain and npm lock, obtains the exact
public HaveAPI revision from `tools/generator.json`, and checks offline
regeneration. It builds JavaScript and declarations once, runs the existing strict
consumer and unit checks, and packs with package scripts disabled.

The checker extracts that archive and checks every manifest-owned module's
JavaScript and declarations in a separate consumer. The workflow retains
the tarball and `receipt.json` as one immutable Actions artifact. The receipt
records package name, version, source commit, tag when present, filename, SHA256
and SHA512 integrity. Build-only validation also accepts private development
packages.

The same archive mode works locally after a normal build:

```sh
nix develop
npm ci --ignore-scripts --no-audit --no-fund
npm run build
mkdir /tmp/vpsadmin-client-package
npm pack --ignore-scripts --pack-destination /tmp/vpsadmin-client-package
node tools/check-package.mjs --archive /tmp/vpsadmin-client-package/*.tgz
```

Choose a fresh directory. This checks a local archive without publishing it.
The ordinary `npm run test:package` command still builds and packs its own
temporary archive for local development.

## First manual publication

Build and validate the archive using the commands above. Retain that exact
tarball and its checksums for publication. npm automatically includes the root
`LICENSE` file in the package.

The maintainer logs in to npm and publishes the validated tarball:

```sh
npm login --registry https://registry.npmjs.org
npm whoami --registry https://registry.npmjs.org
npm publish /path/to/vpsadmin-typescript-client-0.1.0.tgz \
  --ignore-scripts --access public --registry https://registry.npmjs.org
```

Complete any browser authentication or two-factor prompt locally. After
publication, compare the registry's integrity with the retained archive's SHA512
integrity:

```sh
npm view vpsadmin-typescript-client@0.1.0 version dist.integrity \
  --json --registry https://registry.npmjs.org
```

If publication fails or its result is uncertain, check registry state before
retrying; keep the original archive and do not rebuild or repack it.

Manual publication does not enable the workflow. Keep `NPM_RELEASE_ENABLED`
unset or false until trusted publishing is configured for a later release.

## Prerequisites for automated publication

Before enabling publication, a maintainer must:

1. Verify the package license metadata and license file, stable version and
   matching package-lock identity.
2. Verify that `private` is absent or false as an intentional release change.
3. Integrate the reviewed source into `main`. The pushed tag must be exactly
   `vX.Y.Z`, matching the package version, and its commit must be on `main`.
4. Complete the first manual npm publication and establish package ownership. The
   official [`npm trust` prerequisites](https://docs.npmjs.com/cli/v11/commands/npm-trust/)
   require an existing package. npm does not document a pending publisher for a
   new package. This workflow provides no bootstrap upload, token fallback or
   login step.
5. Configure GitHub's `release` environment with required reviewers and tag
   restrictions for authorized release tags. Protect release tag creation and
   retain the workflow's canonical repository restriction.
6. Configure the existing npm package's trusted publisher with these exact fields:
   organization `vpsfreecz`, repository `vpsadmin-typescript-client`, workflow
   filename `release.yml`, environment `release`, and direct-publish permission.
7. Set the repository variable `NPM_RELEASE_ENABLED` to `true` only when these
   prerequisites and the separately authorized release are ready.

A tag run fails preflight while activation or package prerequisites are
incomplete. Version `0.0.0` cannot pass publication preflight. Test the build-only
path without changing registry settings or creating a release tag.

Use GitHub-hosted runners. The pinned npm 11.19.0 and Node 24.21.0 satisfy npm's
trusted-publishing minimums. A new trusted-publisher configuration expires if no
successful publication validates it within two days, so configure it near an
authorized release. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
The package's repository metadata must continue to identify the canonical GitHub
repository. `npm whoami` does not verify OIDC publication authorization.

## Publication and recovery

Only a pushed tag in `vpsfreecz/vpsadmin-typescript-client` can enter the protected
publish job. Branch, pull-request and manual build runs cannot publish. Only the
publish job has `id-token: write`; no npm token is configured. Public-package
publication from the public repository uses npm's automatic OIDC provenance.

After environment approval, the job downloads the build job's immutable artifact
ID, repeats preflight and verifies the original tarball against its receipt.
It publishes that tarball with `--ignore-scripts --access public` to
`https://registry.npmjs.org`. It does not rebuild, repack, install dependencies
or run package scripts. There is no GitHub Release automation or separate
distribution-tag management.

The build job refuses tag reruns, including `Re-run all jobs`, before checkout
or packing. Retrying only the failed publish job reuses the original artifact
ID and fails if that artifact is unavailable.

If publication fails or its result is uncertain, inspect the original run and
the registry's package/version integrity before retrying. Keep the approved
tarball and receipt. Retry only the failed publish job after reconciling the
result; never reupload blindly, replace a published version, move the tag or
overwrite an artifact. If the accepted archive expires or goes missing, stop and reconcile the original
artifacts before choosing how to recover. The workflow does not rebuild an
accepted archive automatically.
