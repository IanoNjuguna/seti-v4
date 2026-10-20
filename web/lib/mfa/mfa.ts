import type { MfaMethod } from '@privy-io/react-auth';

/**
 * The one question the gate asks, and the only place it is asked.
 *
 * `User.mfaMethods` is the list Privy holds for THIS account ("The list of MFA
 * Methods associated with this user", `@privy-io/react-auth` 3.48.1 types). It is
 * not `usePrivy().mfaMethods`, which is the set the APP allows — conflating them
 * would treat "the app supports passkeys" as "this person has one", which is exactly
 * the mistake that makes a gate skip everybody.
 *
 * Deliberately a module function over a shape rather than a hook: the decision is a
 * property of the user object, so it can be reasoned about (and checked) without a
 * React tree, a Privy provider, or a browser.
 */
export interface MfaBearingUser {
  mfaMethods?: readonly MfaMethod[] | null;
}

/**
 * True when the account already has a second factor.
 *
 * A null/undefined/absent list all answer false: a visitor with no session has no
 * method, which is the safe direction — the gate then shows the enrolment screen
 * rather than assuming one exists.
 */
export function hasMfaMethod(user: MfaBearingUser | null | undefined): boolean {
  return (user?.mfaMethods?.length ?? 0) > 0;
}

/**
 * The credential IDs of the passkeys already linked to this account.
 *
 * Privy's passkey enrolment takes the IDs of passkeys that ALREADY exist on the
 * account (`submitEnrollmentWithPasskey({credentialIds})`), so an account that signed
 * up with an emailed code has none and needs one linked first. Narrowing on
 * `type === 'passkey'` is what makes `credentialId` available without a cast.
 */
export function passkeyCredentialIds(
  accounts: readonly { type: string }[] | null | undefined
): string[] {
  return (accounts ?? []).flatMap((account) =>
    account.type === 'passkey' && 'credentialId' in account
      ? [String((account as { credentialId: string }).credentialId)]
      : []
  );
}
