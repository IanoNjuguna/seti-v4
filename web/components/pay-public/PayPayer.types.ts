import type { PayCharge, PayeeDisplay } from '@/lib/charges/charge.types';

/**
 * Which situation the payer is in, as THEY declare it.
 *
 * This page has no session and no wallet, so it cannot detect either one. The payer
 * says which is true in the URL (`?pay=empty`, `?pay=none`) and the page draws that
 * answer. Nothing here is inferred, which is also why the copy says "you said": a
 * page that guessed would be claiming a fact about someone's wallet it never checked.
 *
 *  - `wallet` — dollars in a wallet, so the request itself is drawn. The default.
 *  - `empty`  — a wallet, and nothing in it that can send this.
 *  - `none`   — no wallet at all, so no payment prompt, only what to do instead.
 */
export type PayerState = 'wallet' | 'empty' | 'none';

/** One way out of a payer state: the payer's own words, and the URL that reaches it. */
export interface PayerLink {
  label: string;
  href: string;
}

/** The three values a payer copies when paying from a wallet that is not this browser. */
export interface PayRequestValues {
  address: string;
  amount: string;
  reference: string;
}

export interface PayPayerPanelProps {
  charge: PayCharge;
  payee: PayeeDisplay;
  payer: PayerState;
}

export interface PayRequestDiyProps {
  values: PayRequestValues;
}

export interface PayFundFirstProps {
  /** The last day the request can be paid, as printed, or null for no deadline. */
  openUntil: string | null;
}

export interface PayPayerBlockedProps {
  openUntil: string | null;
}

export interface PayPayerSwitchProps {
  links: PayerLink[];
}
