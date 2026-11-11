/**
 * One of the four squares in the money band.
 *
 * A label and one sentence, and no figure: the page has no balance to show a
 * signed-out visitor (a zero would read as a real balance of nothing) and the fee
 * figure belongs to the band below. What a square carries is a thing you can DO,
 * stated at heading size, which is what the reference's squares carry too.
 */
export interface MoneyTile {
  /** The tile's own heading, set at `heading-md` inside the square. */
  label: string;
  /** One sentence, at the tile's foot. */
  detail: string;
}

/** The money band: the tiles, in the order they are shown. */
export interface MoneySectionCopy {
  /**
   * The band's `h2`: one sentence saying what the three tiles have in common. It is a
   * sentence rather than a label because the band's label ("Your money") was the caps
   * marker, and every band on the page opened with one (#552).
   */
  heading: string;
  /** The three squares, in the order they are shown. */
  tiles: MoneyTile[];
}
