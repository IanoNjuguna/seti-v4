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
  /**
   * The username half's line. Scanning leads, because it is the one a sender can do
   * without typing — and the only one that opens the recipient's app directly. The
   * two typed routes follow in the order they are drawn below the code.
   */
  nameLead: 'Let them scan your QR code or send them your username or link.',
  /** The merchant half's line, same shape, said to a customer instead of a friend. */
  merchantLead: 'Let them scan your QR code or send them your business link.',
} as const;
