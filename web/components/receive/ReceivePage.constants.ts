/**
 * Every word `/app/receive` renders around its halves.
 *
 * The page's own framing — title, the lead that tells a person which half to use,
 * and the three labels on the switch.
 *
 * The LEAD earns its place: "By name" and "By address" name a mechanism, not a
 * choice, so a person with a customer on the phone still has to guess where to
 * send from. One sentence, one clause per route, and it names all three by the
 * thing the SENDER has: another Seti account can pay the username or the merchant
 * name, any other wallet can only pay the address.
 */
export const RECEIVE_PAGE_COPY = {
  title: 'Receive money',
  loading: 'Loading your receive details',
  /**
   * Which half to use, said once, above the switch. "Your username and merchant
   * name" rather than "your name" because a business account holds both and would
   * otherwise read the lead as being about the other one.
   */
  lead: 'Your username and merchant name work from another Seti account. Your address works from any other wallet.',
  /** The three halves, in the order they are offered, named for what the sender has. */
  name: 'Your username',
  address: 'Your address',
  merchant: 'Your merchant name',
} as const;
