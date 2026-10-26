import type { AsyncClient, RequestResult, RequestSpec } from 'haveapi-client';
import { createClient } from './generated/index.js';

export * from './generated/index.js';

/** Use a runtime configured with the versioned API URL from the saved schema. */
export function createHaveApiExecutor(
  runtime: Pick<AsyncClient, 'request'>,
): (spec: RequestSpec) => Promise<RequestResult<unknown>> {
  return (spec) => runtime.request(spec);
}

export function createVpsAdminClient(
  options: Parameters<typeof createClient>[0],
): ReturnType<typeof createClient> {
  return createClient(options);
}
