import type { ChargeSource, ChargeSourceResult, NamedPayee, PayeeDirectory } from './charge.types';

/**
 * FIXTURE DATA — a TEST DOUBLE for charges, and only that.
 *
 * It is imported by `web/scripts/check-pay-charge.mjs` (the gate) and by nothing else:
 * since #131 the pay page reads real charges through `charge-source.ts`, so no route,
 * component or hook, and no deployed build, can reach this file. That is stronger than
 * the previous arrangement, where a `NODE_ENV` flag decided at module load whether the
 * fixture could answer (#161).
 *
 * It exists to pin the page's STATE MACHINE — one charge per state — with values that
 * no real wallet holds. The ids are:
 *
 *   /pay/ch_8f2c1a4e7b9d   pending, a verified Seti name, a memo
 *   /pay/ch_7a1e3d5b9c22   pending, a Seti name that is NOT verified
 *   /pay/ch_2b6d9c0f4a13   pending, an address with no Seti name
 *   /pay/ch_3c8d1f6a7b24   pending, a VERIFIED MERCHANT's name (tier #154)
 *   /pay/ch_4c9a0e2f6b71   paid, with a receipt link
 *   /pay/ch_5d1b7a3c8e04   partly paid
 *   /pay/ch_6e2c8b4d9f35   paid over the amount
 *   /pay/ch_9f3d1c7a2b68   expired
 *   /pay/ch_1a7f4e9c2d60   a signature that does not hold — a refusal
 *
 * Every address below is derived from a label (`sha256('seti-fixture-ian')`) so that
 * nobody's real wallet can appear here by accident, and no balances exist on them.
 */

const IAN = '0x8fad55b7c481bd76889fbf1eb719789f87db5113';
const MWANGI = '0xb4c6c9290dd4bc6e498670c6e1e1f978b118bbda';
const KADE = '0xd335473032775380c8c95a4120f4c593b4dced4c';
/** Deliberately unclaimed: the address-with-no-name state. */
const NO_NAME = '0x596f4c3b5856d7acd8453666db0624ed3ed3caad';

/** The one id whose signature does not hold — see `fixtureSignatureFor`. */
const FORGED_ID = 'ch_1a7f4e9c2d60';

const PAYEES: NamedPayee[] = [
  // A person's name: the claim signature holds, and there is no merchant record at all,
  // so this is NOT the verified tier. It is the case that proves the tier needs the
  // stored review and not just a name that checks out (#154).
  { handle: 'ian', name: 'Ian Njuguna', address: IAN, verified: true, merchantVerifiedAt: null },
  // A business whose claim verifies AND whose merchant record a person reviewed:
  // the one fixture that renders the verified tier.
  {
    handle: 'mwangisuppliers',
    name: 'Mwangi Suppliers',
    address: MWANGI,
    verified: true,
    merchantVerifiedAt: '2026-10-02T09:00:00.000Z',
  },
  // A claim whose signature no longer checks out: named, and marked as unverified.
  // The merchant record is unreviewed too, because an unproven claim cannot inherit one.
  { handle: 'kade-store', name: 'Kade Stores', address: KADE, verified: false, merchantVerifiedAt: null },
];

/** The stored charges, keyed by id, in the shape a source would return. */
const CHARGES: Record<string, Record<string, unknown>> = {
  ch_8f2c1a4e7b9d: {
    id: 'ch_8f2c1a4e7b9d',
    currency: 'KES',
    amount: 1250,
    received: 0,
    recipientAddress: IAN,
    memo: 'October rent',
    expiresAt: null,
    paidAt: null,
    receiptPath: null,
  },
  ch_7a1e3d5b9c22: {
    id: 'ch_7a1e3d5b9c22',
    currency: 'KES',
    amount: 3600,
    received: 0,
    recipientAddress: KADE,
    memo: 'Two kilos of beans',
    expiresAt: null,
    paidAt: null,
    receiptPath: null,
  },
  ch_2b6d9c0f4a13: {
    id: 'ch_2b6d9c0f4a13',
    currency: 'KES',
    amount: 480,
    received: 0,
    recipientAddress: NO_NAME,
    memo: null,
    expiresAt: null,
    paidAt: null,
    receiptPath: null,
  },
  ch_3c8d1f6a7b24: {
    id: 'ch_3c8d1f6a7b24',
    currency: 'KES',
    amount: 4200,
    received: 0,
    recipientAddress: MWANGI,
    memo: 'October stock',
    expiresAt: null,
    paidAt: null,
    receiptPath: null,
  },
  ch_4c9a0e2f6b71: {
    id: 'ch_4c9a0e2f6b71',
    currency: 'KES',
    amount: 2500,
    received: 2500,
    recipientAddress: MWANGI,
    memo: 'Delivery 41',
    expiresAt: null,
    paidAt: '2026-10-14T07:41:00.000Z',
    // Provisional: a charge's receipt is minted by the payable that settles it, so
    // this path becomes real with #131. The page renders the link only when the
    // charge carries one, and never builds it itself.
    receiptPath: '/r/ch_4c9a0e2f6b71?t=fixture',
  },
  ch_5d1b7a3c8e04: {
    id: 'ch_5d1b7a3c8e04',
    currency: 'KES',
    amount: 900,
    received: 400,
    recipientAddress: IAN,
    memo: 'Water bill',
    expiresAt: null,
    paidAt: null,
    receiptPath: null,
  },
  ch_6e2c8b4d9f35: {
    id: 'ch_6e2c8b4d9f35',
    currency: 'KES',
    amount: 1200,
    received: 1400,
    recipientAddress: IAN,
    memo: 'Brake pads',
    expiresAt: null,
    paidAt: '2026-10-16T12:02:00.000Z',
    receiptPath: null,
  },
  ch_9f3d1c7a2b68: {
    id: 'ch_9f3d1c7a2b68',
    currency: 'KES',
    amount: 750,
    received: 0,
    recipientAddress: KADE,
    memo: 'Saturday order',
    expiresAt: '2026-09-30T06:00:00.000Z',
    paidAt: null,
    receiptPath: null,
  },
  ch_1a7f4e9c2d60: {
    id: 'ch_1a7f4e9c2d60',
    currency: 'KES',
    amount: 99000,
    received: 0,
    recipientAddress: MWANGI,
    memo: null,
    expiresAt: null,
    paidAt: null,
    receiptPath: null,
  },
};

/**
 * What a source's signature over a charge looks like here.
 *
 * A STAND-IN, not cryptography: it is the id, restated. Its only job is to make the
 * loader's refusal path real and exercised — the last fixture carries another
 * charge's signature, so `/pay/ch_1a7f4e9c2d60` must refuse rather than draw a
 * KES 99,000 request. The genuine check is the backend's HMAC over the charge
 * (`backend/src/lib/signed-token.ts`), verified where the secret lives; see
 * `load-charge.ts`.
 */
export function fixtureSignatureFor(id: string): string {
  return `fixture-sig:${id}`;
}

/**
 * Every id the fixture answers.
 *
 * Exported so the gate can assert the whole set rather than one lucky id: a
 * production build must refuse all of them (#161), and a development build must
 * still render them.
 */
export const FIXTURE_CHARGE_IDS: readonly string[] = Object.keys(CHARGES);

/** The stored payload for `id`, signed — or null when there is no such charge. */
export const fixtureChargeSource: ChargeSource = {
  async read(id: string): Promise<ChargeSourceResult> {
    const charge = CHARGES[id];
    if (!charge) return null;

    // The forged one is a REFUSAL, not a miss: a charge exists here and must not be
    // paid. The real source answers this from the backend's own re-verification (see
    // `charge-source.ts`), which is why the verdict is a case of the seam rather than
    // a comparison the page makes for itself.
    if (id === FORGED_ID) return { kind: 'refused' };

    return { kind: 'found', payload: { ...charge, signature: fixtureSignatureFor(id) } };
  },
};

/**
 * The address-to-name lookup the backend does not offer yet.
 *
 * `payee.ts` says it plainly: an address cannot be resolved back to a name. When the
 * real charge record carries the handle that was bound when the request was made
 * (or a lookups-by-address read appears), this object is replaced — the interface
 * does not change.
 */
export const FIXTURE_PAYEE_DIRECTORY: PayeeDirectory = {
  async findNamedPayee(address: string): Promise<NamedPayee | null> {
    const match = PAYEES.find((payee) => payee.address.toLowerCase() === address.toLowerCase());
    return match ?? null;
  },
};
