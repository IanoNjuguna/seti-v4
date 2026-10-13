import { get, post } from './client';
import type { AccountIdentity, AccountIntent } from './account.types';

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
