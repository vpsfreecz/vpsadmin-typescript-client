import { createClient } from 'generated/api.js';
import type { NetworkResource, Network__IndexOutput } from 'generated/api.js';
import type { NetworkResource as OwnedNetworkResource } from 'generated/resources/network/resource.js';
import type { Network__IndexOutput as OwnedIndexOutput } from 'generated/resources/network/actions/index.js';
import type { User__PublicKeyResource } from 'generated/resources/user/resources/public_key/resource.js';
import type { User__PublicKeyResource as PublicKeyFromRoot } from 'vpsadmin-typescript-client';
// @ts-expect-error internal action factories are not part of the public package
import { createAction } from 'vpsadmin-typescript-client';
// @ts-expect-error internal resource factories are not part of the public package
import { createResource } from 'vpsadmin-typescript-client';
// @ts-expect-error internal action factories are not re-exported by the API barrel
import { createAction as apiAction } from 'generated/api.js';
// @ts-expect-error internal resource factories are not re-exported by the type barrel
import type { createResource as typeFactory } from 'generated/types.js';

declare const network: NetworkResource;
const ownedNetwork: OwnedNetworkResource = network;
declare const output: Network__IndexOutput;
const ownedOutput: OwnedIndexOutput = output;
declare const publicKey: User__PublicKeyResource;
const rootPublicKey: PublicKeyFromRoot = publicKey;
const client = createClient({ execute: async () => ({ data: [], meta: {}, envelope: { status: true }, httpStatus: 200 }) });
client.network.index();
void [ownedNetwork, ownedOutput, rootPublicKey];
