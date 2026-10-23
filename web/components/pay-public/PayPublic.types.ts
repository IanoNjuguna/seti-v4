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
}

export interface PayQrPanelProps {
  /** The exact string the code encodes: `seti://pay/<id>`. */
  uri: string;
  /** The code's accessible name — what scanning it does, and for how much. */
  title: string;
}
