/**
 * One payment request, as the public pay page draws it.
 *
 * TWO SHAPES, on purpose. `StoredCharge` is what a source hands back — the charge
 * as it was written, signature included. `PayCharge` is what the page is ALLOWED to
 * draw: everything except the signature, because a value the page never holds
 * cannot be rendered, cached, or shipped to the browser inside a React payload.
 *
 * Amounts are plain numbers in the customer's own currency — the unit they think
 * in, and the only one this page prints. What gets signed is the asset behind that
 * figure; that conversion belongs to the backend, and restating it here would be a
 * second money model.
 */

/** Where a charge is, as far as the payer is concerned. */
export type ChargeStatus = 'pending' | 'paid' | 'underpaid' | 'overpaid' | 'expired';

/**
 * The charge exactly as a source stores it.
 *
 * There is deliberately NO `status` field. A status is a conclusion drawn from what
 * arrived and when it was due (`resolveChargeStatus`), so a stored `status: 'paid'`
 * could never disagree with the money. The one thing here that is not derived from
 * the figures is `signature`, and that is the whole trust boundary.
 */
export interface StoredCharge {
  id: string;
  /** ISO 4217 code of the currency the payer thinks in, e.g. `KES`. */
  currency: string;
  /** The principal, in `currency` — what the recipient is owed. */
  amount: number;
  /** How much has arrived against it. `0` while unpaid. */
  received: number;
  /** Where the money goes. The only address this page may ever show. */
  recipientAddress: string;
  /** The reason the payer will recognise, e.g. `October rent`. Never in a URL. */
  memo: string | null;
  /** The last moment the request can be paid, ISO-8601, or null for no deadline. */
  expiresAt: string | null;
  /** When the money arrived, ISO-8601; null while unpaid. */
  paidAt: string | null;
  /** The receipt a paid charge points at, as a PATH (`/r/<id>?t=<token>`), or null. */
  receiptPath: string | null;
  /** The source's signature over the fields above. See `load-charge.ts`. */
  signature: string;
}

/** The stored charge minus the signature: what may be rendered. */
export type PayCharge = Omit<StoredCharge, 'signature'>;

/**
 * A handle bound to an address, as the payee directory reports it.
 *
 * `verified` is the backend's answer, recomputed from the stored claim signature —
 * never a flag this app reads off a request. `address` comes back with the name
 * because the name alone is a label: a handle that now points somewhere else is not
 * a name for THIS address (see `resolve-payee.ts`).
 */
export interface NamedPayee {
  handle: string;
  name: string;
  address: string;
  verified: boolean;
  /**
   * When a person at Seti approved the MERCHANT RECORD this name belongs to, ISO-8601,
   * or null when nobody has reviewed it (#154).
   *
   * A DIFFERENT fact from `verified`, and the reason the pay page needs both. `verified`
   * proves this address controls this name — it is recomputed from the stored claim
   * signature on every read. This proves Seti looked at the business and recorded what it
   * looked at (`merchants."verifiedAt"`, with the evidence beside it). Either alone is
   * still the unverified tier: a name with no reviewed merchant behind it is a name, not
   * a verified merchant, and a reviewed merchant whose claim no longer verifies is not
   * bound to the address the money would go to.
   *
   * STORED, never derived. It is not inferred from volume, age, a memo or the amount —
   * a page that guessed would be selling a trust signal it does not hold.
   */
  merchantVerifiedAt: string | null;
}

/**
 * Who is being paid, in the two display tiers the page can honestly draw (#154).
 *
 *  - `handle` — a Seti name was found for the address; `verified` says whether the
 *    backend's check holds and `merchantVerifiedAt` whether a person reviewed the
 *    merchant behind it. All three are carried, because "named", "checked" and
 *    "reviewed as a merchant" are different promises and collapsing them is how a
 *    forwarded link borrows trust it has not got.
 *  - `address` — no name for this address. The short address is then the identity,
 *    and it is labelled as what it is.
 *
 * There is no third state and no fallback string: a handle arrives from the
 * directory lookup, never from the query, so a payer cannot put a name on the page.
 */
export type PayeeDisplay =
  | ({ kind: 'handle' } & NamedPayee)
  | { kind: 'address'; address: string };

/**
 * The reverse lookup: an address in, the name bound to it out.
 *
 * The real implementation is `backendPayeeDirectory` in `charge-source.ts`, reading
 * `GET /public/payees/:address` (#197). The interface is unchanged from #131 on purpose:
 * the read that answers by address replaced a stub, not a shape. The fixture keeps an
 * implementation of its own so the tier's display states stay renderable without a
 * database (`charge.fixture.ts`), and nothing a deployed build reaches imports it.
 */
export interface PayeeDirectory {
  findNamedPayee(address: string): Promise<NamedPayee | null>;
}

/**
 * What a source answers for one id.
 *
 *  - `null` — there is no charge with that id (the page's `not-found`).
 *  - `{ kind: 'found', payload }` — a charge, still `unknown`: the loader parses it.
 *  - `{ kind: 'refused' }` — the source CHECKED and the charge must not be paid (its
 *    signature does not hold). This is a refusal, not a miss, and the two are
 *    different statements to a payer.
 *
 * `refused` exists because the real source is the backend, which re-verifies the
 * EIP-712 signature from the stored bytes (`backend/src/services/charge-store.ts`).
 * A Next app cannot repeat that check without the chain and the key material, so the
 * source that CAN make it reports the verdict instead.
 */
export type ChargeSourceResult =
  | { kind: 'found'; payload: unknown }
  | { kind: 'refused' }
  | null;

/**
 * Where a charge comes from.
 *
 * `read` returns the payload as `unknown` ON PURPOSE: the loader parses it, so no
 * source can widen the page's types by returning something that merely looks right.
 */
export interface ChargeSource {
  read(id: string): Promise<ChargeSourceResult>;
}

/** What `loadCharge` answers. Three outcomes, and none of them is a blank page. */
export type ChargeLoadResult =
  | { kind: 'charge'; charge: PayCharge; payee: PayeeDisplay; status: ChargeStatus }
  | { kind: 'not-found' }
  | { kind: 'invalid' };
