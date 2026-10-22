/**
 * Invitations: the link, the signed code behind it, and who it attributes.
 *
 * THE ONE PROMISE THIS FILE KEEPS: a `Referral` row is written when an account is
 * ESTABLISHED, and never because a link was opened. An open is a visit by an
 * unknown person, possibly a link unfurler, possibly someone reading a message
 * they were forwarded. Only `attributeSignupInvite` writes, it is called from
 * `POST /auth/verify` after `createAccount` says it CREATED something, and the
 * unique index on `invitedUserId` makes the second write impossible.
 *
 * WHY THE CODE NAMES AN ID AND NOT A HANDLE
 *
 * The signed payload carries the REFERRER'S USER ID, and the handle beside it is
 * only a display snapshot. A handle is a namespace entry that can be parked for
 * brand review, released, and reissued to a brand (`HandleRelease`); a cookie that
 * re-resolved `seti.live/i/ian` at attribution time would credit whoever holds the
 * string then, which is a customer's invite credited to a stranger's wallet
 * because the brand review happened in between. The id cannot be reassigned.
 *
 * The signature is the repo's ONE HMAC scheme (`lib/signed-token.ts`), so the
 * cookie cannot be forged into naming a different referrer. It is NOT a session:
 * it grants nothing, it reads nothing, and the only thing it can ever cause is one
 * row naming its own referrer.
 *
 * WHY EVERY REFUSAL IS SILENT
 *
 * A person who opens a dead invite has done nothing wrong and needs nothing fixed,
 * so an unknown handle mints no code and a bad, expired or forged code attributes
 * nobody, both without an error. The alternative — telling a visitor "this invite
 * expired" — is a message about a link they may have been sent by a stranger, and
 * it is also the only place that would let an attacker probe which handles have
 * invites outstanding.
 */
import { prisma } from '../lib/prisma.js';
import { sign, signaturesMatch } from '../lib/signed-token.js';
import { isUniqueViolation } from '../lib/unique-violation.js';
import { findHandleByHandle } from './handles.js';

/**
 * How long an invite works, in seconds. The page sets its cookie from this same
 * number, so "30 days" is one fact rather than two that can drift.
 *
 * A month is long enough for "I will sign up this weekend" and short enough that a
 * forwarded link in a group chat is not an invite forever. The expiry lives INSIDE
 * the signed payload, so shortening it later invalidates outstanding codes rather
 * than silently extending them.
 */
export const INVITE_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * The product's public host, for the link the API hands back.
 *
 * A SECOND COPY of the host, deliberately — the mirror is `web/lib/merchant-link.ts`,
 * where the host is stated for the client, and `check:referral` imports that module
 * at runtime and asserts both build the same URL. The API cannot import from `web/`
 * (different package, different build), so the alternative is either no link in the
 * response or an un-pinned copy; this is the copy with a check on it.
 */
const INVITE_HOST = 'seti.live';

/** The invite link for a handle: `seti.live/i/<handle>`. */
export function inviteLink(handle: string): string {
  return `https://${INVITE_HOST}/i/${handle}`;
}

/**
 * The account that never attributes and is never attributed.
 *
 * The dev bypass is one shared fixture of a development box, so an invite from it
 * would count a person who does not exist, and an invite TO it would count the
 * fixture as a customer. Both are refused here rather than at the call sites
 * (`middleware/auth.ts` owns the same address for the same reason: there is one
 * dev account, and every copy of its address has to agree).
 */
const DEV_ACCOUNT_EMAIL = 'dev@seti.test';

/** The signed payload. Short keys because it rides in a cookie. */
interface InvitePayload {
  /** The referrer's user id. The ONLY authority in the code. */
  r: string;
  /** The handle the link named, frozen for the snapshot. Never re-resolved. */
  h: string;
  /** Expiry, epoch milliseconds. */
  exp: number;
}

/** What a verified code says. */
export interface VerifiedInvite {
  referrerId: string;
  /** The name the invitee saw, kept as the row's snapshot. */
  referrerHandle: string;
}

/**
 * Mint the code a link has to hand out, or `null` when it must hand out nothing.
 *
 * `null` for every reason a link cannot invite: no such handle, a handle that is
 * parked for brand review (`findHandleByHandle` filters those out already, so it
 * simply is not found), a BUSINESS name (a shop invites nobody: the link would
 * have to name a person, and there is no person behind it), and a handle row with
 * no account attached.
 *
 * Resolved through `findHandleByHandle` rather than a lookup written here, because
 * that resolver IS the namespace's one rule: a second lookup would be a second
 * answer to "does this name exist", and the invite link would then be the one
 * surface that disagrees with `seti.live/u/<handle>` about who is there.
 */
export async function inviteCodeFor(handle: string): Promise<string | null> {
  const found = await findHandleByHandle(handle);

  if (!found) return null;
  if (found.kind !== 'person') return null;
  if (!found.userId) return null;
  if (await isDevAccount(found.userId)) return null;

  return issueInviteCode(found.userId, found.handle);
}

/** The signed code for a known referrer. Exported for the check suite. */
export function issueInviteCode(referrerId: string, handle: string, now = Date.now()): string {
  const payload: InvitePayload = {
    r: referrerId,
    h: handle,
    exp: now + INVITE_TTL_SECONDS * 1000,
  };

  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${sign(body)}`;
}

/**
 * Read a code, or `null` for EVERY failure: missing, malformed, forged, expired.
 *
 * The signature is checked BEFORE the payload is parsed, so no JSON a stranger
 * wrote is ever read by this process. Nothing distinguishes the failures to the
 * caller, on purpose: to the app they are one event ("this invite does not count"),
 * and the only audience that could tell them apart is someone probing for valid
 * codes.
 */
export function readInviteCode(code: string | null | undefined, now = Date.now()): VerifiedInvite | null {
  if (!code) return null;

  const separator = code.lastIndexOf('.');
  if (separator <= 0) return null;

  const body = code.slice(0, separator);
  const signature = code.slice(separator + 1);
  if (!signaturesMatch(sign(body), signature)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  const payload = parsed as Partial<InvitePayload> | null;
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.r !== 'string' || payload.r.length === 0) return null;
  if (typeof payload.h !== 'string') return null;
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null;
  if (payload.exp <= now) return null;

  return { referrerId: payload.r, referrerHandle: payload.h };
}

/**
 * Why an attribution did or did not happen — returned rather than thrown, and
 * returned rather than logged, so the one caller (sign-in) can stay silent and the
 * check suite can assert each branch.
 */
export type AttributionOutcome =
  | 'attributed'
  | 'not-new-account'
  | 'no-code'
  | 'self'
  | 'dev-account'
  | 'duplicate';

export interface AttributeSignupInput {
  /** The account that was just established. */
  userId: string;
  /** Whether THIS call created the account. Sign-in is not sign-up. */
  created: boolean;
  /** The code the browser carried, if any. */
  code?: string | null;
  /** Injectable clock, for the expired-code proof. */
  now?: number;
}

/**
 * Attribute an invite to the account that just signed up — the ONE writer.
 *
 * `created` is the first thing checked, and it is checked HERE rather than in the
 * route, so "new accounts only" is a property of the writer and not of one call
 * site remembering to ask. Every refusal is a return value: nothing here throws for
 * a caller's bad code, and the caller must still contain a database fault
 * (`POST /auth/verify` wraps this in a catch, because an attribution problem must
 * never be the reason a person cannot sign in).
 */
export async function attributeSignupInvite(input: AttributeSignupInput): Promise<AttributionOutcome> {
  if (!input.created) return 'not-new-account';

  const invite = readInviteCode(input.code, input.now);
  if (!invite) return 'no-code';

  // Never self: the person who opened their own link and then signed up is not
  // their own invitation. Comparing IDs (not handles) is what makes this hold
  // after a rename.
  if (invite.referrerId === input.userId) return 'self';

  if (await isDevAccount(invite.referrerId)) return 'dev-account';
  if (await isDevAccount(input.userId)) return 'dev-account';

  try {
    await prisma.referral.create({
      data: {
        referrerId: invite.referrerId,
        invitedUserId: input.userId,
        referrerHandle: invite.referrerHandle,
      },
    });

    return 'attributed';
  } catch (error) {
    // A second code for the same invitee is the EXPECTED collision: the unique
    // index refused the second write, which is exactly what it is for.
    if (isUniqueViolation(error)) return 'duplicate';

    // A code naming an account that no longer exists fails the foreign key. That
    // is a dead invite, not a fault worth failing a sign-up over.
    if (isMissingReferrer(error)) return 'no-code';

    throw error;
  }
}

/** The invite screen's payload: exactly what a referrer may know. */
export interface ReferralSummary {
  /** The caller's live username, or `null` when they hold none. */
  handle: string | null;
  /** The link to hand out, or `null` for the same reason. */
  link: string | null;
  /** How many accounts arrived on this account's invites. */
  count: number;
  /** Who joined, newest first. A handle is `null` for an invitee who has not claimed one. */
  joined: { handle: string | null; joinedAt: string }[];
}

/**
 * What an account may know about the people it invited.
 *
 * A HANDLE AND A TIME, and nothing else — no email, no address, no amount, and no
 * count of what anyone spent. The invitee agreed to nothing except that opening a
 * link and signing up is an arrival someone can count; their email is the one fact
 * that would make this surface an address book, so it is not selected at all (the
 * `select` below lists the columns rather than including the row, which is what
 * stops a later field on `User` from arriving here by default).
 *
 * The handle is read LIVE rather than snapshotted: if an invitee renames, the
 * referrer sees the name the account actually holds now, because a name is how
 * money reaches a person and showing a retired one would be a broken name. An
 * invitee who has not claimed a name yet contributes `null` rather than being
 * dropped: dropping them would make `count` disagree with the list.
 */
export async function referralSummary(userId: string): Promise<ReferralSummary> {
  const [handle, rows] = await Promise.all([
    prisma.handle.findFirst({
      where: { userId, kind: 'person', reviewStatus: null },
      orderBy: { createdAt: 'desc' },
      select: { handle: true },
    }),
    prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        invited: {
          select: {
            handles: {
              where: { kind: 'person', reviewStatus: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { handle: true },
            },
          },
        },
      },
    }),
  ]);

  return {
    handle: handle?.handle ?? null,
    link: handle ? inviteLink(handle.handle) : null,
    count: rows.length,
    joined: rows.map((row) => ({
      handle: row.invited.handles[0]?.handle ?? null,
      joinedAt: row.createdAt.toISOString(),
    })),
  };
}

/** Whether this account is the shared development fixture. */
async function isDevAccount(userId: string): Promise<boolean> {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  return account?.email === DEV_ACCOUNT_EMAIL;
}

/** A foreign key that does not resolve: the code names an account that is gone. */
function isMissingReferrer(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'P2003';
}
