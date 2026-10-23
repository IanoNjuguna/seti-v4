import type { ReactNode } from 'react';
import type { ChargeAmounts } from '@/lib/charges/charge-fee';
import type { ChargeStatus, PayCharge, PayeeDisplay } from '@/lib/charges/charge.types';
import type { PayerState } from './PayPayer.types';

/**
 * Props for the public pay view and its parts.
 *
 * Every value here was decided SERVER-SIDE — the charge, who is being paid, what
 * state it is in, and which situation the payer declared. Nothing in this module
 * reads a cookie, a session, or a query parameter, and no part of it needs JavaScript
 * to draw.
 */
export interface PayPublicViewProps {
  charge: PayCharge;
  payee: PayeeDisplay;
  status: ChargeStatus;
  /** The payer's declared situation (`pay-public.payer.ts`), never a detected one. */
  payer: PayerState;
}

export interface PayStatusLineProps {
  status: ChargeStatus;
  /** The one sentence saying what this state means and what to do about it. */
  step: string;
}

export interface PayAmountPanelProps {
  currency: string;
  amount: number;
  memo: string | null;
}

export interface PayFeeBreakdownProps {
  currency: string;
  amounts: ChargeAmounts;
  /** The sentence under the rows: the fee is on top, the recipient gets the whole amount. */
  note: string;
}

export interface PayRecipientProps {
  payee: PayeeDisplay;
  /** The charge id, drawn beside the recipient: it is what a payer can compare with the shop. */
  chargeId: string;
}

/**
 * Which of the two display tiers (#154) a payee is drawn in.
 *
 *  - `verified` — a Seti name is bound to this address, the claim signature holds, and
 *    the merchant record behind it carries a review date. The name and the mark are shown.
 *  - `unverified` — everything else. The handle or the short address, our own mark, our
 *    facilitated-by line, the charge id, and one sentence saying the recipient is not
 *    verified with Seti.
 *
 * It is a DISPLAY distinction and nothing else: the charge, the fee, the amount, the
 * address the money goes to and the settlement are identical in both tiers. Anything
 * that changed them would be a second product.
 */
export type PayeeTier = 'verified' | 'unverified';

/**
 * The recipient, decided for display: every string a recipient block draws.
 *
 * Built by `payeeIdentity()` in `pay-public.tier.ts`, so no component holds a branch of
 * its own about who counts as verified — there is exactly one place that answers it, and
 * `check-pay-tiers.mjs` pins it.
 */
export interface PayeeIdentity {
  tier: PayeeTier;
  /** The line the heading draws: a reviewed merchant's name, else `@handle`, else the address. */
  heading: string;
  /** The heading is an address, so it is drawn in mono like every other address. */
  headingIsAddress: boolean;
  /** The address, shortened to be read. Drawn on BOTH tiers: it is where the money goes. */
  address: string;
  /** The full address, for `title`: truncation helps recognition, never hides. */
  fullAddress: string;
  /** `@handle`, when a Seti name is bound. Null for a stranger's address. */
  handle: string | null;
  /** The address gets its own line under a name or a handle; not under an address heading. */
  showAddressLine: boolean;
  /** No Seti name for this address at all. A fact about the address, not a verdict on it. */
  noName: boolean;
}

export interface PayFacilitatorNoteProps {
  /** The charge id, as stored. The one string a payer can hold the shop to. */
  chargeId: string;
}

export interface PayPageFrameProps {
  /** What the page draws inside the frame: the request, or a refusal. */
  children: ReactNode;
}

export interface PayQrPanelProps {
  /** The exact string the code encodes: `seti://pay/<id>`. */
  uri: string;
  /** The code's accessible name — what scanning it does, and for how much. */
  title: string;
}
