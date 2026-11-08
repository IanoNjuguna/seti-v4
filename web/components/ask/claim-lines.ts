import type { RequestState } from '@/lib/api/requests';

/**
 * What a claim link says when there is nothing to pay (#447).
 *
 * A claim that is already paid, withdrawn or lapsed must not open a payment form: the only thing a
 * payment for it could produce is a send the settle refuses, and the payer would learn that at the end
 * of a flow instead of at the start.
 *
 * One place, because two surfaces render these: `/app/pay?ask=` forwards a claim link, and `/app/send`
 * is where that claim is resolved. Two copies of four sentences is how "already paid" starts meaning
 * two different things.
 */
export type ClaimAnswer = { title: string; body: string };

const ANSWERS: Record<Exclude<RequestState, 'open'>, ClaimAnswer> = {
  settled: {
    title: 'This has been paid',
    body: 'The money is already with the person who asked. Nothing more is owed on this claim.',
  },
  cancelled: {
    title: 'This was withdrawn',
    body: 'Whoever wrote this claim took it back. Ask them for a new one if it is still owed.',
  },
  expired: {
    title: 'This has lapsed',
    body: 'Claims stop being payable after the window the person chose. Ask them for a fresh one.',
  },
};

/** The answer for an id that resolves to nothing, or to something this build cannot read. */
export const CLAIM_UNKNOWN: ClaimAnswer = {
  title: 'This link does not work',
  body: 'It may have been mistyped, or it may never have been a claim. Check it with whoever sent it.',
};

/**
 * The sentence a claim's state earns, or null when it is still payable.
 *
 * `null` for open on purpose: the caller decides what to mount, and a function that returns a component
 * would be a component. `unknown` is separate from the three states because it is a fact about the LINK
 * rather than about the money.
 */
export function claimAnswer(state: RequestState | 'unknown' | null): ClaimAnswer | null {
  if (state === null || state === 'open') return null;
  if (state === 'unknown') return CLAIM_UNKNOWN;
  return ANSWERS[state];
}
