import type { ChargeSource, NamedPayee, PayeeDirectory } from './charge.types';

/**
 * FIXTURE DATA — placeholder for charges that the backend does not have yet.
 *
 * #129 and #131 build charges and the API that serves them. Until they land there is
 * nothing to read, so this file supplies eight charges, one per state the pay page
 * must be able to render, and a directory with three named payees. It is imported by
 * `load-charge.ts` ONLY, and that file is the single seam #131 replaces — nothing
 * under `components/` or `app/` knows these exist.
 *
 * The ids are the eight URLs a human can open today:
 *
 *   /pay/ch_8f2c1a4e7b9d   pending, a verified Seti name, a memo
 *   /pay/ch_7a1e3d5b9c22   pending, a Seti name that is NOT verified
 *   /pay/ch_2b6d9c0f4a13   pending, an address with no Seti name
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
  { handle: 'ian', name: 'Ian Njuguna', address: IAN, verified: true },
  { handle: 'mwangisuppliers', name: 'Mwangi Suppliers', address: MWANGI, verified: true },
  // A claim whose signature no longer checks out: named, and marked as unverified.
  { handle: 'kade-store', name: 'Kade Stores', address: KADE, verified: false },
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
  async read(id: string): Promise<unknown> {
    const charge = CHARGES[id];
    if (!charge) return null;

    // The forged one carries a signature minted for a different charge.
    const signingId = id === FORGED_ID ? 'ch_4c9a0e2f6b71' : id;
    return { ...charge, signature: fixtureSignatureFor(signingId) };
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
