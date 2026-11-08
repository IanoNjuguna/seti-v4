import type { RequestState } from '@/lib/api/requests';

/**
 * What a claim link does next (#447).
 *
 * The payer opened `/app/pay?ask=<id>`. Before anything is signed, one question decides the whole
 * screen: is this claim still payable? A claim that was already paid, cancelled or has lapsed must NOT
 * open a payment form, because the only thing that can come of it is a send the settle will refuse.
 *
 * Pure, and separate from the page, so the four answers can be asserted without a browser.
 */
export interface ClaimReadable {
  publicId: string;
  destinationHandle: string;
  amount: string;
  currency: string;
  status: RequestState;
}

export type ClaimRoute =
  | { kind: 'forward'; href: string }
  | { kind: 'answer'; title: string; body: string };

/**
 * The one sentence each unpayable state earns.
 *
 * Each names the consequence rather than the mechanism: "already paid" is not about a row's status, it
 * is about the money having left somebody's account. None of them offers a retry, because a retry here
 * would be a second payment for one claim.
 */
const ANSWERS: Record<Exclude<RequestState, 'open'>, { title: string; body: string }> = {
  settled: {
    title: 'This has been paid',
    body: 'The money is already with the person who asked. Nothing more is owed on this claim.',
  },
  cancelled: {
    title: 'This was withdrawn',
    body: 'Whoever wrote this claim took it back. Ask them to send a new one if it is still owed.',
  },
  expired: {
    title: 'This has lapsed',
    body: 'Claims stop being payable after the window the person chose. Ask them for a fresh one.',
  },
};

export const CLAIM_NOT_FOUND: { title: string; body: string } = {
  title: 'This link does not work',
  body: 'It may have been mistyped, or it may never have been a claim. Check it with whoever sent it.',
};

/**
 * Map a claim read to the next thing the payer sees.
 *
 * A missing or unreadable claim and an unknown one are the same answer on purpose: the id is a
 * capability, so distinguishing "no such claim" from "not yours" would turn this page into a probe.
 */
export function claimRoute(claim: ClaimReadable | null): ClaimRoute {
  if (!claim) return { kind: 'answer', ...CLAIM_NOT_FOUND };

  if (claim.status !== 'open') {
    const answer = ANSWERS[claim.status];
    return { kind: 'answer', ...answer };
  }

  /*
   * `to` and `claim` only: the amount stays behind, in the row. `/app/send`'s seed whitelist drops a
   * figure from a URL on purpose (#99), and a claim is not an exception to that rule: the send flow
   * reads the figure from the claim itself.
   */
  const query = new URLSearchParams({ to: claim.destinationHandle, claim: claim.publicId });
  return { kind: 'forward', href: `/app/send?${query.toString()}` };
}
