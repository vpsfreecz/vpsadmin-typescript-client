# 0.3.0

- Generate version-root and concrete-action live description calls through the
  existing executor.
- Export `ClientInputError` for validation failures before dispatch and preserve
  executor errors unchanged.
- Type global response metadata from each action's declared output.
- Support a configured wire metadata namespace while preserving canonical object
  metadata in `data` and the original raw envelope.
- Refresh the controlled full-fixture schema capture and generator provenance.
- Require `haveapi-client` 0.32.0 and check strict consumers with TypeScript 6
  and the WebUI's TypeScript 5.9 Bundler mode.

# 0.2.0

- Format generated TypeScript source with Prettier 3.9.10 and the configuration
  packaged with HaveAPI 0.32.0.
- Preserve the generated API, public types and runtime behavior. The exact
  `haveapi-client` runtime dependency remains 0.30.2.
