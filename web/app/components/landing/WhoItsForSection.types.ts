/**
 * One kind of seller the page names, as a heading and one sentence.
 *
 * `title` is the reader's own label for their business ("Shops and traders"), so it is
 * rendered as the item's `h3` rather than as a caption: a reader scanning the band is
 * looking for the words they would use for themselves.
 */
export interface SellerKind {
  title: string;
  body: string;
}

/** The "who it is for" band: its marker, its heading and the three kinds of seller. */
export interface WhoItsForCopy {
  /** The band's marker, set in caption size above the heading. */
  eyebrow: string;
  /** The band's `h2`. A count of what the band holds, which is what "Three" is doing. */
  heading: string;
  /** Exactly three, in the order they are rendered. */
  items: SellerKind[];
}
