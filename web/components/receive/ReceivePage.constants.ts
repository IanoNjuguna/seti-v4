/**
 * The receive page's own words.
 *
 * The page carries the FRAMING — its title, which half is which, and the sentence
 * that explains the half on screen — while each card carries only the objects that
 * half hands over. That split is deliberate: the first version of this surface put
 * a heading, a paragraph and a code inside one card, and the card then sat under a
 * page heading that said the same thing, so one screen stated the same fact four
 * times and every card was a wall to read before it could be used.
 *
 * `nameLead` is the name half's sentence, moved out of the card verbatim. It is the
 * owner's wording and it names the three things that half hands over — the code, the
 * name, the link — in the order they appear on it.
 *
 * The address half has no lead sentence on purpose: its card states the network in
 * words ("Send on Practice. This is your Practice deposit address."), which is the
 * only thing a person must read there, and repeating it above the code would be the
 * same clutter in a different place.
 *
 * Practice | Live and never "testnet"/"mainnet": those are the database's words,
 * not a customer's.
 */
export const RECEIVE_PAGE_COPY = {
  title: 'Receive money',
  loading: 'Loading your receive details',
  /**
   * Which half to use, said once, above the switch.
   *
   * The two labels ("By name" / "By address") name the mechanisms, not the
   * choice — a person with a customer on the phone still has to guess which tab
   * answers "where do I send this from?". One sentence, parallel, one clause per
   * tab: the name works from another Seti account, the address works from any
   * other wallet. That is the whole decision.
   */
  lead: 'Your name works from another Seti account. Your address works from any other wallet.',
  /** The two halves, named for what the SENDER has rather than for what the code is. */
  name: 'By name',
  address: 'By address',
  nameLead: 'Send them your qr code, user name, or address link.',
} as const;
