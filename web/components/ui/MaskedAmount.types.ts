import type { ReactNode } from 'react';
import type { TextColor, TextVariant } from './Text.types';

/** Where the mask sits inside the space the figure leaves behind. */
export type MaskAlign = 'start' | 'end';

export interface MaskedAmountProps {
  /** From `useAmountPrivacy`. Passed in rather than read here: this stays a primitive. */
  hidden: boolean;
  /** The figure's own type, so the swap happens at the same size and no line moves. */
  variant?: TextVariant;
  /**
   * The figure's own colour role. The mask has to be as legible as what it replaces:
   * on the dark balance card the variant's default ink would be invisible, which is a
   * toggle that looks broken rather than private.
   */
  color?: TextColor;
  align?: MaskAlign;
  /** The figure. Rendered as-is; the caller owns its type and colour. */
  children: ReactNode;
}
