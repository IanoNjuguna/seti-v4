import { get, post } from './client';
import type { AccountIdentity, AccountIntent, DepositTarget } from './account.types';
import type { Network } from '@/lib/network';

/**
 * The caller's handles and mode.
 *
 * This is the ONE read the onboarding gate is built on. It asks about the CALLER
 * — no id in the path — which is what makes it impossible to read another
 * account's handles by editing a URL, and it is what makes `onboarded` a
 * derived answer rather than a client-side guess.
 */
export async function fetchAccountIdentity(): Promise<AccountIdentity> {
  return get<AccountIdentity>('/account');
}

/**
 * Switch the account's mode, and get the identity back.
 *
 * No requirement that a handle for that mode exists yet: choosing `business` before
 * a business name is claimed is the normal order, and the claim that follows is what
 * creates the name. Refusing the switch until then would make the intent a one-way
 * door.
 */
export async function setAccountIntent(intent: AccountIntent): Promise<AccountIdentity> {
  return post<AccountIdentity>('/account/intent', { intent });
}

/**
 * Switch the account's network — Practice ⇄ Live.
 *
 * `network` here is the TARGET of a switch, not an assertion about the current
 * request: the caller asks the server to move the account and the server decides
 * whether it can. A switch to `mainnet` is refused with a `mainnet-not-ready`
 * reason while no real mainnet batch proof exists, so the Live control can say
 * WHY it is disabled.
 *
 * Everything returned comes from the account read on the NEW network: the
 * handles there, the deposit address, and the readiness state.
 */
export async function setAccountNetwork(network: Network): Promise<AccountIdentity> {
  return post<AccountIdentity>('/account/network', { network });
}

/**
 * The address money arrives at, and the network it belongs to.
 *
 * A GET with no body and no query, deliberately: the network a deposit is on is
 * the one this DEPLOYMENT serves, so there is nothing for a client to say about
 * it and nothing for a client to get wrong. See `DepositTarget`.
 */
export async function fetchDepositTarget(): Promise<DepositTarget> {
  return get<DepositTarget>('/account/deposit');
}
