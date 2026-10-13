/**
 * The account's identity as the app needs to ask about it — and the ONE read
 * that decides whether onboarding is finished.
 *
 * ## The gate is derived, not stored
 *
 * There is no `onboardedAt` column and no `onboarded` boolean anywhere in the
 * database. The question "has this account finished onboarding?" is answered by
 * data that already has to exist for the product to work at all: a signed-in
 * user with NO handle cannot be paid by name, cannot be sent to, and has nothing
 * `seti.live/u/<handle>` or `/m/<handle>` could point at. So `onboarded` is
 * COMPUTED here, every read, from the set of handles the account holds.
 *
 * That is the whole point of deriving it. A stored flag can disagree with the
 * rows — a handle removed by support, a claim that landed but whose flag write
 * failed — and the disagreement is invisible: the app reads the flag, the
 * resolver reads the handles, and the two tell a customer different things.
 * Here there is one source and the answer cannot drift from it.
 *
 * ## The intent is the one thing the handles cannot answer
 *
 * `intent` is NOT part of the gate. It answers a different question — which mode
 * the account is acting as — and it is needed only because an account may
 * legitimately hold BOTH a username and a business name (try it as a person, add
 * a business later). With both present, "which mode am I in" has no derivable
 * answer, and deriving it anyway would make `business` permanent the moment a
 * business name exists: the one-way door the reversible-intent requirement
 * forbids. Nothing is ever refused because of this value — it selects surfaces,
 * it does not gate access.
 */
import { prisma } from '../lib/prisma.js';
import { HANDLE_PROFILE_SELECT } from './handles.js';
import { toHandleIdentityView, type HandleIdentityView } from './handle-claims.js';

/**
 * The mode an account acts as: `personal` or `business`.
 *
 * Deliberately NOT the same union as `HandleKind` (`person` | `business`), and the
 * one-character difference is the point. The KIND is a property of a HANDLE — what
 * a name was claimed as, which decides the `purpose` its signature carries. The
 * INTENT is a property of the ACCOUNT — which mode it is presenting as, which is a
 * preference. Collapsing them would mean an account could only ever be the kind of
 * its most recent handle, which is how a switch becomes a one-way door.
 *
 * The two are bridged by ONE map, in the web app where the choice is made
 * (`web/lib/account/account.constants.ts`): a personal intent claims a `person`
 * handle. The backend never needs the bridge — it is told the kind on the claim and
 * the intent on the switch, and both are validated by their own guard.
 */
export type AccountIntent = 'personal' | 'business';

export const ACCOUNT_INTENTS: readonly AccountIntent[] = ['personal', 'business'];

export function isAccountIntent(value: unknown): value is AccountIntent {
  return value === 'personal' || value === 'business';
}

export interface AccountIdentity {
  /**
   * The active mode. A preference, never a gate — an account with an intent and
   * no handle is still not onboarded.
   */
  intent: AccountIntent;
  /** Every handle the account holds, person and business alike. */
  handles: HandleIdentityView[];
  /**
   * DERIVED, on every read: the account holds at least one handle. This is the
   * gate the app routes on. It is a computed answer, not a stored one.
   */
  onboarded: boolean;
}

/** A stored intent this build does not recognise reads as `personal`. */
function normalizeIntent(stored: string): AccountIntent {
  return isAccountIntent(stored) ? stored : 'personal';
}

/**
 * The caller's handles and mode.
 *
 * Scoped to `userId` in the WHERE clause rather than filtered after the read: a
 * handle belongs to whoever signed for it, and reading every handle then
 * discarding the rest is how a per-account read turns into a scan of the
 * namespace. The business profile is joined only to carry a business's
 * `category` (a person has none).
 */
export async function getAccountIdentity(userId: string): Promise<AccountIdentity> {
  const [user, handles] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { intent: true } }),
    prisma.handle.findMany({
      where: { userId },
      include: HANDLE_PROFILE_SELECT,
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const views = await Promise.all(handles.map((handle) => toHandleIdentityView(handle)));

  return {
    // A missing user is not a reason to refuse the whole read: the middleware
    // already resolved this id from a verified token, and `personal` is what a
    // fresh account is. The handles are what the gate reads, and they are empty.
    intent: normalizeIntent(user?.intent ?? 'personal'),
    handles: views,
    onboarded: views.length > 0,
  };
}

/**
 * Record the mode the account is acting as, and return the new identity.
 *
 * No guard on which modes are reachable and no effect on any handle: choosing
 * `business` before a business name exists is not an error, it is the state
 * right before the claim that creates one. Refusing it would make the intent
 * switch a one-way door again, one layer up.
 */
export async function setAccountIntent(
  userId: string,
  intent: AccountIntent
): Promise<AccountIdentity> {
  await prisma.user.update({ where: { id: userId }, data: { intent } });
  return getAccountIdentity(userId);
}
