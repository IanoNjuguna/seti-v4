/**
 * Copy for the app frame — the app's honesty about which network it is on.
 *
 * The words are the network's OWN product word (`NETWORK_LABEL`, Practice | Live)
 * and its one plain sentence (`NETWORK_NOTE`), both owned by `lib/network`; this
 * file holds only what the chrome itself has to say, so the frame cannot invent a
 * second way of stating the same fact. There used to be three — a badge, a
 * sentence and a "Network:" label — and by the time one screen carried all three
 * the fact had been read four times and believed once.
 *
 * A screenshot of this app must still carry its network in text: a practice
 * payment and a live one differ only by which chain they happened on.
 */
export const APP_FRAME_COPY = {
  /** Read aloud for the rail's practice row, which is a link to the switch. */
  railRowHint: 'Practice. Choose Network in Profile to go Live.',
  /** The line under the money on a payment the customer is about to sign. */
  commitNote: 'This is practice money.',
} as const;
