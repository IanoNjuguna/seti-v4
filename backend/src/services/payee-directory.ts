/**
 * The public pay page's BY-ADDRESS read (#197).
 *
 * ## The question
 *
 * A charge names an ADDRESS and nothing else, so the page cannot ask "who is
 * `javahouse`". It has to ask: is the wallet this money goes to a merchant a person at
 * Seti reviewed, and what did they look at? Until this file existed the answer was the
 * web seam's hardcoded `null`, so the verified tier that shipped in #154 could not be
 * reached by a live page at all: it was, in production, the rollback state.
 *
 * ## Three answers, and a name only when all three are yes
 *
 *  1. **A live claim is bound to this exact address.** A row in `handles` whose
 *     `address` IS this address (compared lowercased), with `reviewStatus = null`. A
 *     parked (`pending`) or `reserved` row is a name that does not resolve: every
 *     resolver filters it out, and this one must too, or a held name would appear on a
 *     pay page while `seti.live/<handle>` 404s.
 *  2. **That claim still verifies.** Recomputed from the stored signature over the row's
 *     CURRENT name, purpose and address (`handleClaimVerifies`), which is what makes a
 *     repointed or tampered row read as unverified rather than as somebody else's name.
 *     There is no stored flag to flip, and this read does not add one.
 *  3. **The merchant record carries a review.** `verifiedAt` AND `verifiedEvidence`, the
 *     pair a CHECK constraint writes and clears together (migration
 *     `20261023120000_merchant_verification`). A date with no evidence is not a review,
 *     and #154's badge has to be defensible by the next reviewer.
 *
 * `name` and `merchantVerifiedAt` come back TOGETHER or not at all, so a caller cannot
 * pair a review date with a claim that does not hold and draw a badge from half an
 * answer. Anything less than all three returns `name: null`, and the page draws
 * `@handle` or the address.
 *
 * `verifiedEvidence` is a GATE, never a payload. It is the case or reference the
 * reviewer worked from (#154: "never rendered"), and this route is unauthenticated, so
 * the public view carries the fact that a review exists and not what it was reviewed
 * against. There is deliberately no field for it on `PublicPayee`.
 *
 * ## Why an address is looked up case-insensitively
 *
 * `claimHandle` stores the EIP-55 CHECKSUMMED form (`getAddress`), so the column holds
 * mixed case; a charge stores its recipient lowercased. Comparing either form directly
 * would miss the other. The comparison is therefore on a lowered input with
 * `mode: 'insensitive'`, and the input is shape-checked FIRST: this comparison treats
 * `%` and `_` as wildcards, so an address has to be 20 bytes of hex before it is
 * allowed anywhere near the query.
 *
 * The cost, stated rather than hidden: there is no index on `handles.address`
 * (migrations were not touched by #197, which is read-only by design), so this is one
 * sequential filter over a table of claimed NAMES, not of money. It is per charge render
 * and runs alongside a `findUnique` on the charge itself.
 *
 * ## No cache, and that is the rule rather than an omission
 *
 * A withdrawal (clearing `verifiedAt` and `verifiedEvidence`) must drop the name on the
 * NEXT render, not at a cache expiry. Nothing here memoises, and the web directory that
 * calls it is registered with `cache: 'no-store'`, so the only staleness possible is one
 * in-flight request.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { servedNetwork, type Network } from '../config/networks.js';
import { handleClaimVerifies } from './handle-claims.js';

/** An address as the wire spells it: 20 bytes of hex, either casing. */
const ADDRESS_QUERY = /^0x[0-9a-f]{40}$/;

/**
 * What the public pay page may read about the recipient of a charge.
 *
 * `handle` is always present: an address a claim is bound to has a string a payer can
 * recognise. `name` and `merchantVerifiedAt` are the verified tier, and they are null
 * together whenever any of the three answers is not yes.
 */
export interface PublicPayee {
  /** The stored handle, lowercased by the claim rule. */
  handle: string;
  /** The merchant's name, or null when this address is not a reviewed merchant. */
  name: string | null;
  /** The address the claim is stored against, in its stored (checksummed) form. */
  address: string;
  /** Whether the stored claim signature still recovers to `address`, on its network. */
  verified: boolean;
  /** When a person approved the merchant record, ISO-8601, or null. */
  merchantVerifiedAt: string | null;
}

/**
 * The columns a re-verification and the review gate need, and nothing about any
 * account: no user, no wallet, no balance. This read is reachable signed out.
 */
const BOUND_HANDLE_SELECT = {
  handle: true,
  kind: true,
  name: true,
  address: true,
  network: true,
  purpose: true,
  claimSignature: true,
  claimIssuedAt: true,
  claimNonce: true,
  claimedAt: true,
  createdAt: true,
  merchant: { select: { verifiedAt: true, verifiedEvidence: true } },
} as const;

type BoundHandleRow = Prisma.HandleGetPayload<{ select: typeof BOUND_HANDLE_SELECT }>;

/**
 * When a person reviewed the merchant behind a claim, or null.
 *
 * A review is TWO stored facts, and the CHECK constraint refuses to let them disagree
 * in the database. Reading both here anyway is not redundancy for its own sake: this is
 * the last gate between a badge and a payer, and a record that somehow carries a date
 * with a blank evidence string must read as "nobody reviewed this" rather than as a
 * verification nobody can defend. Exported so the check can hold the gate to its word
 * without a second copy of the rule.
 */
export function reviewedMerchantAt(
  merchant: { verifiedAt: Date | null; verifiedEvidence: string | null } | null | undefined
): string | null {
  if (!merchant?.verifiedAt) return null;

  const evidence = merchant.verifiedEvidence?.trim() ?? '';
  if (evidence.length === 0) return null;

  return merchant.verifiedAt.toISOString();
}

/**
 * Which bound claim speaks for an address when more than one does.
 *
 * The resolver's own precedence, restated for a lookup keyed on something else
 * (`findHandleByHandle`): the row claimed on THIS network wins, and a person's username,
 * which is global, is the fallback. A business name claimed on the other network is not
 * a name for this deployment's money, so it is never adopted here.
 */
export function pickBoundClaim<T extends { network: string; kind: string }>(
  rows: readonly T[],
  network: Network = servedNetwork
): T | null {
  return rows.find((row) => row.network === network) ?? rows.find((row) => row.kind === 'person') ?? null;
}

/**
 * Who is paid at `address`, and what has been checked about them, or null.
 *
 * Null means "no Seti name for this address", which is the common case today and NOT an
 * error: the page draws the address and its unverified sentence. It is also what a
 * malformed address gets, since no stored claim can be bound to a string that is not an
 * address.
 */
export async function findPayeeByAddress(
  address: string,
  network: Network = servedNetwork
): Promise<PublicPayee | null> {
  const queried = typeof address === 'string' ? address.trim().toLowerCase() : '';
  if (!ADDRESS_QUERY.test(queried)) return null;

  const rows = await prisma.handle.findMany({
    where: {
      address: { equals: queried, mode: 'insensitive' },
      reviewStatus: null,
    },
    select: BOUND_HANDLE_SELECT,
    // Deterministic when one address holds more than one live claim: the newest claim
    // first, and a row with no `claimedAt` (a backfilled claim) behind it.
    orderBy: [{ claimedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
  });

  const row = pickBoundClaim(rows, network);
  if (!row) return null;

  return toPublicPayee(row);
}

/** The row, reduced to what a payer may read. One place decides, so no caller can. */
async function toPublicPayee(row: BoundHandleRow): Promise<PublicPayee> {
  const verified = await handleClaimVerifies({
    name: row.name,
    address: row.address,
    purpose: row.purpose,
    claimSignature: row.claimSignature,
    claimIssuedAt: row.claimIssuedAt,
    claimNonce: row.claimNonce,
    network: row.network,
  });

  const reviewedAt = reviewedMerchantAt(row.merchant);
  const name = row.name.trim();
  const allThree = verified && reviewedAt !== null && name.length > 0;

  return {
    handle: row.handle,
    name: allThree ? name : null,
    address: row.address,
    verified,
    merchantVerifiedAt: allThree ? reviewedAt : null,
  };
}
