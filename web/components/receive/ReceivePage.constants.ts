/**
 * Every word `/app/receive` renders around its halves.
 *
 * The page now shows ONE code: the username. The address view is gone and the Seti
 * link row with it, so the framing below is about a person and their username, and
 * a business gets one extra sentence because it is the only account that has a
 * second string worth showing.
 *
 * The LEAD earns its place differently than it used to. It used to spend a clause
 * per route ("by name", "by address"), which named mechanisms and left a person with
 * a customer on the phone guessing. Now it names what the SENDER has — another Seti
 * account — and says nothing about a mechanism at all. A payer from outside Seti has
 * nowhere to go on this page any more, so the lead does not pretend otherwise.
 *
 * The switch's labels name the STRING a customer is choosing to show (your username,
 * your merchant name), because that is the choice the control makes. They never name
 * a channel: "By name" / "By address" was the failure this page already paid for.
 */
export const RECEIVE_PAGE_COPY = {
  title: 'Receive money',
  loading: 'Loading your receive details',
  /** A person: one sentence, and it is the whole fact of the surface. */
  lead: 'Any Seti account can pay you by username.',
  /**
   * A business: the second clause is the merchant name, which is what a customer
   * pays at the counter. It is a second sentence rather than a second page because
   * the two are two strings on one account, not two products.
   */
  leadBusiness: 'A Seti account pays you by username. A customer pays your merchant name.',
  /** The two halves, in the order they are offered, named for the string they show. */
  name: 'Your username',
  merchant: 'Your merchant name',
  /**
   * The state an account with no name of its own lands in: what is missing, why it
   * matters, and the route that fixes it.
   *
   * The TITLE and the BUTTON come from the same place the rail's identity card gets
   * them (`PROFILE_INTENT_COPY` through `useRailIdentity().claim`), so the claim this
   * page offers cannot promise a different thing than the claim in the rail. Only the
   * middle sentence is this page's, because only this page knows what the missing
   * name would have been used for.
   */
  emptyPersonBody:
    'A username is the name another Seti account types to pay you. Without one there is nothing on this page to hand over.',
  emptyBusinessBody:
    'A business name is what a customer pays at your counter. Without one there is nothing on this page to show them.',
  /** The account read failed. Named, not shown as a blank column. */
  failedTitle: 'Could not load your username',
  failedBody: 'Your details did not arrive. Try again in a moment.',
  failedAction: 'Try again',
} as const;
