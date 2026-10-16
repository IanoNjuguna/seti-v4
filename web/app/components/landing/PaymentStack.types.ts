/**
 * One movement in the payment stack: a payment that arrived, or one you sent.
 *
 * Shaped like the app's own transaction row, because that is what the band is
 * showing — not a marketing graphic, a feed.
 */
export interface StackedPayment {
  /** Stable key. Also the source of the avatar letter. */
  id: string;
  /** The merchant's name, or the handle when the counterparty is a person. */
  name: string;
  /** Signed, in `currency`: money in is positive, a send is negative. */
  amount: number;
  /** The currency the figure is in. Never a token — see the constants file. */
  currency: string;
  /** The line under the name: who paid you, or that this one went out. */
  detail: string;
  /** A written-out relative time. All three differ, on purpose. */
  time: string;
}

/** One card, positioned by the stack. */
export interface PaymentCardProps {
  payment: StackedPayment;
  /** The entrance class and the phone/screen visibility rule, from the stack. */
  className?: string;
}
