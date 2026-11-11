import type { TransactionGlyph } from './TransactionRow.types';

/** The two tints a row's circle may take. */
export type RowMarkTone = 'quiet' | 'in';

export interface RowMarkProps {
  /**
   * What happened, drawn as a glyph. `null` or absent means the row has a name behind it and the
   * circle draws the initial instead.
   */
  icon?: TransactionGlyph | null;
  /** One letter, taken from a name the row actually has. Ignored when `icon` is set. */
  initial?: string;
  /** Only money ARRIVING takes the success tint; everything else stays the quiet well. */
  tone?: RowMarkTone;
  className?: string;
}
