import type { RecentRecipient } from '@/lib/api';

/**
 * The send screen's repeat entry point, as pure functions (#99).
 *
 * Two rules, and both decide whether a control exists at all — which is exactly the
 * kind of thing a screenshot cannot prove: a list with no history must draw
 * NOTHING rather than an empty shell, and a tap must name a target the send flow
 * can actually resolve.
 */

/**
 * What tapping this person fills the payee field with, or null when there is
 * nothing to fill it with.
 *
 * The HANDLE when they have one, absolutely: the send flow re-resolves a name
 * before anything is signed, so the money goes to whoever holds that name NOW.
 * Trusting the cached address would pay a name that has since changed hands, which
 * is the risk the issue names. The address is the fallback for the rows that only
 * ever had one, and it is the same string a pasted address would be.
 *
 * The amount is deliberately NOT part of this. A repeat fills the payee and
 * nothing else: the customer types what they are sending, every time, so no figure
 * they did not choose can ever reach a signature.
 */
export function repeatTarget(recipient: RecentRecipient): string | null {
  const handle = recipient.handle?.trim();
  if (handle) return handle;

  const address = recipient.address?.trim();
  return address ? address : null;
}

/**
 * Whether the recent block is drawn at all.
 *
 * False for an account with no history: no heading, no empty box, no placeholder
 * rows. A block that says "no recent people" is a sentence about a feature; the
 * send flow's own field is the answer for that customer.
 */
export function showsRecents(recipients: readonly RecentRecipient[]): boolean {
  return recipients.some((recipient) => repeatTarget(recipient) !== null);
}

/**
 * The second line of a row: the address, for a person named by a handle.
 *
 * Null when the name IS the address (a row that was only ever an address): printing
 * the shortened address under its own shortened self says nothing twice, and there
 * is no other name to give it that would not be invented.
 */
export function repeatDetail(recipient: RecentRecipient): string | null {
  if (!recipient.handle) return null;
  return recipient.address || null;
}
