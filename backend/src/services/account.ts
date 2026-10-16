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
import { toHandleIdentityView, grantFirstRefusal, type HandleIdentityView } from './handle-claims.js';
import { mainnetReadiness, servedNetwork, type MainnetReadiness } from '../config/networks.js';
import {
  chainIdForNetwork,
  NETWORK_LABEL,
  normalizeNetwork,
  type Network,
} from '../lib/network.js';
import { getActiveWallet } from './wallet-registry.js';

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
  /**
   * Every name the account holds ON ITS ACTING NETWORK, person and business
   * alike — its business names on that network, plus its PERSON name wherever it
   * was claimed (a username is global). Scoped by network so a practice business
   * name and a live business name never appear in one list.
   * A `reserved` hold (first refusal on a business name not yet re-claimed) is NOT
   * a handle the account holds — it does not resolve and does not verify — so it is
   * excluded.
   */
  handles: HandleIdentityView[];
  /**
   * DERIVED, on every read: the account holds at least one handle on its acting
   * network. This is the gate the app routes on. It is a computed answer, not a
   * stored one.
   */
  onboarded: boolean;
  /** The network the account is acting on: `testnet` (Practice) | `mainnet` (Live). */
  network: Network;
  /** The network's product word: Practice | Live. */
  networkLabel: string;
  /**
   * Whether this deployment can move LIVE money, and the reason it cannot when it
   * cannot. The Profile's Live control is DISABLED with this reason — never a
   * bare disabled control.
   */
  live: MainnetReadiness;
  /**
   * The account's LIVE deposit address, or null when none is registered yet.
   *
   * v1 has no on-ramp, so a live account starts EMPTY: the Live side shows this
   * address with a plain "fund this from another wallet" note. It is the active
   * wallet on the mainnet network, which is a different address from the practice
   * one.
   */
  depositAddress: string | null;
}

/** A stored intent this build does not recognise reads as `personal`. */
function normalizeIntent(stored: string): AccountIntent {
  return isAccountIntent(stored) ? stored : 'personal';
}

/**
 * Where money arrives for this account, ON THE NETWORK THIS DEPLOYMENT SERVES.
 *
 * ## What is actually per-network
 *
 * The ADDRESS is not. An EVM address is one identifier that exists on every chain;
 * Privy creates one embedded wallet per account (`createOnLogin:
 * 'users-without-wallets'`) and every `wallets` row this app writes holds THAT
 * address — verified in this database, where every account has a single address.
 * What is per-network is:
 *
 *  1. which CHAIN the sender must send on, and
 *  2. which network VIEW the money then lands in — the ledger, the balance and the
 *     receipts this app reads are scoped by network, so a deposit made on the other
 *     Tempo network is real money at a real address that this network's view does
 *     not show.
 *
 * ## Why this still refuses to invent an answer
 *
 * The wallet ROW is per network, and an account may hold one on the other network
 * only — this deployment's own table currently has testnet rows and no mainnet
 * ones, because they predate the switch. So the served network's row is the only
 * correct answer to "which chain should a deposit be sent on, and which view will
 * show it", and a row from the other network would answer both wrongly. This read
 * therefore takes the row for the network the DEPLOYMENT serves, and returns null
 * when there is none rather than falling back to another network's.
 *
 * `getAccountIdentity` reports the account's acting preference separately
 * (`network`), and the Profile rail is where that is chosen. This deliberately
 * does not consult that value: a client build that disagrees with the server about
 * the network must not be able to make the deposit surface name the other chain.
 *
 * The read is the account's ACTIVE wallet on the served network — the same row
 * `registerWallet` writes at login and the same lookup the balance path uses — so
 * what the surface shows and what the account is registered with cannot be two
 * different rows.
 */
export interface DepositTarget {
  /** The network the CHAIN below belongs to — the one this deployment serves. */
  network: Network;
  /** The network's product word: Practice | Live. */
  networkLabel: string;
  /** The chain id the deposit must be sent on — the load-bearing half of this answer. */
  chainId: number;
  /** The account's active address on that network, or null when none is registered. */
  address: string | null;
}

export async function getDepositTarget(userId: string): Promise<DepositTarget> {
  const wallet = await getActiveWallet(userId, servedNetwork);

  return {
    network: servedNetwork,
    networkLabel: NETWORK_LABEL[servedNetwork],
    chainId: chainIdForNetwork(servedNetwork),
    address: wallet?.address ?? null,
  };
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { intent: true, network: true },
  });

  // The network the account is acting on — server-decided, from its stored
  // preference. This is the scope every read below is taken under.
  const network = normalizeNetwork(user?.network);

  const [handles, liveWallet] = await Promise.all([
    prisma.handle.findMany({
      where: {
        userId,
        // A name in force on the acting network, which is EITHER the name this
        // account holds on that network OR its PERSON name, wherever it was
        // claimed — a username is global, so the account has it on both networks
        // and switching must not hide it. Without this second branch the Live side
        // read "No username yet" and the gate saw `onboarded: false`: the person
        // LOST their name in the UI by switching, and would have been sent back
        // through onboarding they had already finished.
        AND: [{ OR: [{ network }, { kind: 'person' }] }],
        // `reserved` holds are excluded: they are not names the account HOLDS,
        // only strings held FOR it on the other network. (A person's name is never
        // held that way any more — it is global — but a business's still is.)
        OR: [{ reviewStatus: null }, { reviewStatus: { not: 'reserved' } }],
      },
      include: HANDLE_PROFILE_SELECT,
      orderBy: { createdAt: 'asc' },
    }),
    // The live deposit address: the active wallet on the mainnet network, which
    // is a DIFFERENT address from the practice one. Null until one is registered.
    getActiveWallet(userId, 'mainnet'),
  ]);

  const views = await Promise.all(handles.map((handle) => toHandleIdentityView(handle)));

  return {
    // A missing user is not a reason to refuse the whole read: the middleware
    // already resolved this id from a verified token, and `personal` is what a
    // fresh account is. The handles are what the gate reads, and they are empty.
    intent: normalizeIntent(user?.intent ?? 'personal'),
    handles: views,
    onboarded: views.length > 0,
    network,
    networkLabel: NETWORK_LABEL[network],
    live: mainnetReadiness(),
    depositAddress: liveWallet?.address ?? null,
  };
}

/**
 * The two ways switching to a network can be refused, or the new identity.
 *
 * `mainnet-not-ready` is the ONE PRODUCT GATE: Live is refused with a STATED
 * REASON until the deployment is mainnet-ready (a real mainnet batch receipt
 * exists — docs/internal/mainnet-flip.md), never silently and never with a bare
 * disabled control.
 */
export type AccountNetworkResult =
  | { ok: true; identity: AccountIdentity }
  | { ok: false; code: 'mainnet-not-ready'; reason: string };

/**
 * Switch the account's network — Practice ⇄ Live.
 *
 * Live is refused while the deployment is not mainnet-ready, with the readiness
 * reason, so the control can say WHY it is disabled rather than just being grey.
 *
 * On a switch to live, the account's existing BUSINESS names get FIRST REFUSAL on
 * the live network (`grantFirstRefusal`): a `reserved` row holds each string for
 * the account, so a practice business name is not stealable in the gap between the
 * practice claim and the live one. Switching back to practice needs no reservation
 * — the practice names are already held. A PERSON's username needs no hold at all:
 * it is global, so it is already the account's on both networks and no other
 * account can take it (see `grantFirstRefusal` and the `Handle` model).
 */
export async function setAccountNetwork(
  userId: string,
  target: Network
): Promise<AccountNetworkResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { network: true } });
  const current = normalizeNetwork(user?.network);

  if (target === current) {
    return { ok: true, identity: await getAccountIdentity(userId) };
  }

  if (target === 'mainnet') {
    const readiness = mainnetReadiness();
    if (!readiness.ready) {
      return { ok: false, code: 'mainnet-not-ready', reason: readiness.reason ?? 'Live is not available yet.' };
    }

    // First refusal BEFORE the account is moved, so the names are held by the time
    // the app renders the live side.
    await grantFirstRefusal(userId, 'mainnet');
  }

  await prisma.user.update({ where: { id: userId }, data: { network: target } });

  return { ok: true, identity: await getAccountIdentity(userId) };
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
