/** The sizes a token mark is drawn at. `sm` is for a control, `md` for body text, `lg` for a row. */
export type TokenMarkSize = 'sm' | 'md' | 'lg';

export interface TokenMarkProps {
  /** The ledger's asset label (`ousd`, `usdc.e`), which is what the file map is keyed by. */
  asset: string;
  size?: TokenMarkSize;
  className?: string;
}
