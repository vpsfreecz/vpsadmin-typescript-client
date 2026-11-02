# 0.3.0

- Regenerate from the full vpsAdmin API fixture with HaveAPI 0.32.2 and require
  exact `haveapi-client` 0.32.0.
- Add live API and action descriptions, typed response metadata and metadata
  namespace overrides.
- Report generated input validation failures as `ClientInputError` before
  calling the executor. Preserve the identity of transport errors.

# 0.2.0

- Format generated TypeScript source with Prettier 3.9.10 and the configuration
  packaged with HaveAPI 0.32.0.
- Preserve the generated API, public types and runtime behavior. The exact
  `haveapi-client` runtime dependency remains 0.30.2.
