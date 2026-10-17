import { prisma } from '../lib/prisma.js';
import { servedNetwork } from './chain.js';
import { isUniqueViolation } from '../lib/unique-violation.js';
import { checkAcceptedTermsVersion, recordSignupConsent, type ConsentRefusal } from './consent.js';

/**
 * Creating an account — the sign-up step, and the ONE place a consent row is
 * written.
 *
 * Extracted from `POST /auth/verify` for two reasons, and neither is tidiness:
 *
 *  1. **The consent record must be written exactly once.** It belongs to the
 *     CREATION of an account, so the code that creates one has to be able to say
 *     whether it created anything. An `upsert` cannot: it answers with the row
 *     and never says which branch ran, so a re-login through the same path would
 *     have written a second consent row (or, worse, a first one for an account
 *     that already had one) with nothing to distinguish the two.
 *  2. **Only one writer may win.** Two sign-ups racing on one address both create
 *     nothing but one P2002; the loser takes the existing row and records no
 *     consent. A read-then-upsert would have had both of them see "not found" and
 *     write two rows.
 *
 * The route stays the thing that knows about HTTP; this is the thing that knows
 * what an account creation means.
 */
export interface CreateAccountInput {
  email: string;
  phone?: string;
  /** The terms version the client says it accepted, if it sent one. */
  acceptedVersion?: string;
  ip?: string;
}

export type CreateAccountResult =
  | { ok: true; userId: string; created: boolean }
  | ({ ok: false } & ConsentRefusal);

/**
 * Create the account, or adopt the one that email already has.
 *
 * Order matters: the terms cross-check runs BEFORE anything is written, so a
 * client that accepted a different version is refused without leaving an account
 * (and a consent row) behind.
 */
export async function createAccount(input: CreateAccountInput): Promise<CreateAccountResult> {
  const refusal = checkAcceptedTermsVersion(input.acceptedVersion);
  if (refusal) return { ok: false, ...refusal };

  try {
    const user = await prisma.user.create({
      // The network the deployment SERVES, stated rather than inherited. The column
      // default is `testnet`, so a new account created on a live box would read
      // practice rows — and look empty — until the first switch it can no longer make.
      data: { email: input.email, phone: input.phone, network: servedNetwork },
    });

    await recordSignupConsent({
      userId: user.id,
      acceptedVersion: input.acceptedVersion,
      ip: input.ip,
    });

    return { ok: true, userId: user.id, created: true };
  } catch (error) {
    // One test for a unique violation, shared with the ledger's idempotency guard
    // (`lib/unique-violation.ts`): a P2002 here IS the expected collision — the
    // address already exists — and anything else is a real failure.
    if (!isUniqueViolation(error)) throw error;

    // The address exists, so this is a RETURNING identity, not a sign-up. Nothing
    // is created and nothing is recorded — the account keeps the consent row it
    // already has, and its `createdAt` still answers when it first accepted.
    const existing = await prisma.user.update({
      where: { email: input.email },
      // Same rule as the create above: the served network is re-derived per sign-in.
      data: { phone: input.phone ?? undefined, network: servedNetwork },
    });

    return { ok: true, userId: existing.id, created: false };
  }
}
