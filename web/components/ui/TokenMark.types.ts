/** The sizes a token mark is drawn at. `sm` is for a row, `md` for a control. */
export type TokenMarkSize = 'sm' | 'md';

export interface TokenMarkProps {
  /** The ledger's asset label (`ousd`, `usdc.e`), which is what the file map is keyed by. */
  asset: string;
  size?: TokenMarkSize;
  className?: string;
}
