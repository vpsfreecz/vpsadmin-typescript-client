# 0.6.0

- Add generated read operations and types for the administrator incident-policy
  overview and evaluation history, including offset pagination and response
  metadata.

# 0.5.0

- Add generated operations and types for incident policies, per-VPS policy settings
  and saved incident policy evaluations.
- Include saved counting periods, nullable match results and policy notice fields
  in incident report types.
- Allow `null` for the `value` input of system configuration updates.

# 0.4.0

- Add advisory retraction and deletion operations.
- Accept `expected_state` on advisory, CVE and node-status mutations so callers
  can guard writes against a changed advisory state.

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
