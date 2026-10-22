/**
 * The recipient's second signature: managing a charge they already created.
 *
 * Creating a charge is signed by the recipient's wallet over the charge itself
 * (`services/charge.ts`). Cancelling it, and reading the delivery log, are different
 * permissions on an object that already exists, so they cannot reuse that signature —
 * the create signature sits in the charge and any payer holding the link could replay
 * it. They get their own message instead:
 *
 *   ChargeAdmin { chargeId, action, issuedAt, nonce }
 *
 * under the SAME domain as the charge (`Seti` / `1` / `chainId`), verified with the
 * same instrument (`verifyTypedData`), and the recovered address has to BE the
 * charge's `recipient`. That is the whole authorisation story: whoever controls the
 * payee's key can cancel their own charge, and nobody else can.
 *
 * ## Why a time window and not a used-nonce table
 *
 * `issuedAt` must be within {@link CHARGE_ADMIN_WINDOW_MS} of now, so a captured
 * header expires on its own. The trade is deliberate: a used-nonce table would make a
 * `cancel` strictly single-use, but cancel is already idempotent by STATE (it only
 * ever moves `pending`, and the second attempt is refused with `charge-not-pending`),
 * and the other action is a read that changes nothing. A table would therefore buy
 * nothing and cost a write on every read of a delivery log. If a state-changing admin
 * action is ever added, it needs the table and this comment is where to start.
 *
 * Sent in headers (`x-seti-signature`, `x-seti-issued-at`, `x-seti-nonce`) rather than
 * in a body, because one of the two actions is a GET and both should read the same.
 */
import { getAddress, recoverTypedDataAddress, type Hex } from 'viem';
import { CHARGE_DOMAIN_NAME, CHARGE_DOMAIN_VERSION } from './charge.js';

/** What the signature authorises. A closed set, so a new action is a code change. */
export const CHARGE_ADMIN_ACTIONS = ['cancel', 'deliveries'] as const;

export type ChargeAdminAction = (typeof CHARGE_ADMIN_ACTIONS)[number];

/** The EIP-712 struct name. Distinct from `Charge`, so the two can never be confused. */
export const CHARGE_ADMIN_PRIMARY_TYPE = 'ChargeAdmin';

/** The typed-data struct — the field SET and each field's type are the contract. */
export const CHARGE_ADMIN_TYPES = {
  [CHARGE_ADMIN_PRIMARY_TYPE]: [
    { name: 'chargeId', type: 'string' },
    { name: 'action', type: 'string' },
    { name: 'issuedAt', type: 'string' },
    { name: 'nonce', type: 'string' },
  ],
} as const;

/**
 * How long an admin signature stays usable after `issuedAt`, in milliseconds.
 *
 * Five minutes: long enough for a clock that drifts by seconds and for a person who
 * signs and then pastes a `curl`, short enough that a leaked header is dead by the
 * time anyone could use it. Both directions are checked, so a signature dated in the
 * future is refused too — a forged `issuedAt` would otherwise extend its own life.
 */
export const CHARGE_ADMIN_WINDOW_MS = 5 * 60 * 1000;

/** The three headers an admin call carries. */
export const CHARGE_ADMIN_HEADERS = {
  signature: 'x-seti-signature',
  issuedAt: 'x-seti-issued-at',
  nonce: 'x-seti-nonce',
} as const;

export interface ChargeAdminMessage {
  chargeId: string;
  action: ChargeAdminAction;
  issuedAt: string;
  nonce: string;
}

/** The typed data a recipient's wallet signs for one admin action. */
export function chargeAdminTypedData(message: ChargeAdminMessage, chainId: number) {
  return {
    domain: { name: CHARGE_DOMAIN_NAME, version: CHARGE_DOMAIN_VERSION, chainId },
    types: CHARGE_ADMIN_TYPES,
    primaryType: CHARGE_ADMIN_PRIMARY_TYPE,
    message: {
      chargeId: message.chargeId,
      action: message.action,
      issuedAt: message.issuedAt,
      nonce: message.nonce,
    },
  } as const;
}

/** Who signed this admin message, or null when it cannot be read. */
export async function recoverChargeAdminSigner(input: {
  message: ChargeAdminMessage;
  signature: string;
  chainId: number;
}): Promise<string | null> {
  try {
    const recovered = await recoverTypedDataAddress({
      ...chargeAdminTypedData(input.message, input.chainId),
      signature: input.signature as Hex,
    });
    return getAddress(recovered).toLowerCase();
  } catch {
    return null;
  }
}

export type ChargeAdminVerdict =
  | { ok: true }
  | {
      ok: false;
      /** `charge-signature-invalid` — not the recipient's key, or unreadable. */
      /** `charge-admin-stale` — issued outside the window. */
      code: 'charge-signature-invalid' | 'charge-admin-stale';
      reason: string;
    };

/**
 * Verify an admin signature against a charge's recipient.
 *
 * The window is checked FIRST, before any crypto: an expired header is not worth a
 * recovery, and the answer (stale) is more useful than "invalid signature" for a
 * caller staring at a clock that is wrong.
 */
export async function verifyChargeAdmin(input: {
  chargeId: string;
  recipient: string;
  action: ChargeAdminAction;
  headers: { signature: string | null; issuedAt: string | null; nonce: string | null };
  chainId: number;
  now?: Date;
}): Promise<ChargeAdminVerdict> {
  const { signature, issuedAt, nonce } = input.headers;

  if (!signature || !issuedAt || !nonce) {
    return {
      ok: false,
      code: 'charge-signature-invalid',
      reason: 'A managing call must be signed by the charge recipient: send x-seti-signature, x-seti-issued-at and x-seti-nonce.',
    };
  }

  const issued = Date.parse(issuedAt);
  if (Number.isNaN(issued)) {
    return {
      ok: false,
      code: 'charge-admin-stale',
      reason: `x-seti-issued-at "${issuedAt}" is not an ISO-8601 instant.`,
    };
  }

  const now = (input.now ?? new Date()).getTime();
  if (Math.abs(now - issued) > CHARGE_ADMIN_WINDOW_MS) {
    return {
      ok: false,
      code: 'charge-admin-stale',
      reason: `The signature was issued at ${issuedAt}, more than ${CHARGE_ADMIN_WINDOW_MS / 60_000} minutes from now.`,
    };
  }

  const signer = await recoverChargeAdminSigner({
    message: { chargeId: input.chargeId, action: input.action, issuedAt, nonce },
    signature,
    chainId: input.chainId,
  });

  if (!signer || signer !== input.recipient.toLowerCase()) {
    return {
      ok: false,
      code: 'charge-signature-invalid',
      reason: `This signature does not come from charge ${input.chargeId}'s recipient ${input.recipient}.`,
    };
  }

  return { ok: true };
}
