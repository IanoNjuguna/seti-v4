import { prisma } from '../lib/prisma.js';

/**
 * What a live session is served AS, and the one way resolving it fails.
 *
 * A session is established once — at `POST /auth/verify`, when a Privy token is
 * first exchanged for a local account. What that call proves is a Privy SUBJECT
 * (the DID in the token), which is immutable for the life of the account, and it
 * is bound to the account here (`bindSessionIdentity`). Every later request must
 * resolve the caller from THAT binding and nothing else
 * (`resolveSessionIdentity`).
 *
 * The bug this replaces: the middleware re-derived the account from the email
 * Privy reports at request time. An email is a mutable attribute — it is the
 * ENTRY key at login, and it can change afterwards — so "who this session is"
 * was recomputed from a value that does not identify a session. A later change
 * to it then re-pointed or killed a session that had been established for a
 * different identity, and the history recorded under the old session appeared to
 * belong to whoever holds that email now. Snapshotting the subject at
 * establishment and never re-deriving it is the fix.
 */
export type SessionIdentityRefusal = 'session-identity-unknown';

export interface SessionIdentity {
  id: string;
  email: string;
}

export const SESSION_IDENTITY_UNKNOWN: SessionIdentityRefusal = 'session-identity-unknown';

/**
 * Said the same way wherever the refusal surfaces, so a support lookup and a
 * client error are the same sentence.
 */
export function sessionIdentityUnknownMessage(): string {
  return (
    'This session does not resolve to an account. Sign in again so the app can ' +
    'establish the identity it is served as.'
  );
}

/**
 * The account a verified token belongs to, resolved by the SUBJECT the session
 * was established with — never by the email Privy reports now.
 *
 * There is deliberately no email fallback. A fallback would re-introduce exactly
 * the re-resolution this closes: the caller would once again be identified by a
 * mutable attribute, and an account that had never been bound could be reached by
 * an email that happens to match today. An unbound or unknown subject refuses —
 * a session the app can act on (re-authenticate), never a silently mis-attributed
 * one.
 *
 * A subject with no binding is where accounts that predate the binding column and
 * the dev bypass user land; refusing sends them through `/auth/verify` once, which
 * binds them.
 */
export async function resolveSessionIdentity(
  privyDid: string | undefined
): Promise<SessionIdentity | { code: SessionIdentityRefusal; reason: string }> {
  if (!privyDid) {
    return { code: SESSION_IDENTITY_UNKNOWN, reason: sessionIdentityUnknownMessage() };
  }

  const user = await prisma.user.findUnique({ where: { privyDid } });

  if (!user) {
    return { code: SESSION_IDENTITY_UNKNOWN, reason: sessionIdentityUnknownMessage() };
  }

  return { id: user.id, email: user.email };
}

/**
 * Bind an account to the Privy subject its session was established with.
 *
 * Called once, from `POST /auth/verify`. A subject already held by a DIFFERENT
 * account is refused rather than moved: the subject is an identity, and moving it
 * on demand would let one account take over another's ledger by presenting its
 * email. Idempotent for the account that already holds it.
 */
export async function bindSessionIdentity(
  userId: string,
  privyDid: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const holder = await prisma.user.findUnique({ where: { privyDid } });

  if (holder && holder.id !== userId) {
    return {
      ok: false,
      reason:
        'That Privy identity is already bound to a different account, so this login ' +
        'cannot take it over. Contact support if this is unexpected.',
    };
  }

  if (!holder) {
    await prisma.user.update({ where: { id: userId }, data: { privyDid } });
  }

  return { ok: true };
}
