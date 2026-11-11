/**
 * Copy for the app frame — the app's honesty about which network it is on.
 *
 * The words are the network's OWN product word (`NETWORK_LABEL`, Practice | Live)
 * and its one plain sentence (`NETWORK_NOTE`), both owned by `lib/network`; this
 * file holds only what the payment itself has to say. There used to be more — a
 * badge, a sentence and a "Network:" label in the rail and in a frame strip — and
 * by the time one screen carried all three the fact had been read four times and
 * believed once. The strip and the rail are gone (#542); the state is stated in the
 * header's chip and the sentence is stated here, once, under the money.
 *
 * A screenshot of this app must still carry its network in text: a practice
 * payment and a live one differ only by which chain they happened on.
 */
export const APP_FRAME_COPY = {
  /** The line under the money on a payment the customer is about to sign. */
  commitNote: 'This is practice money.',
} as const;
