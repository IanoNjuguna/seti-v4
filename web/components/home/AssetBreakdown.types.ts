import type { AssetBalanceRow } from '@/lib/api/home.types';

export interface AssetBreakdownProps {
  /** What the balance is made of, largest first, as the dashboard returns it. */
  rows: AssetBalanceRow[];
  /** The headline figure, exactly as the card shows it, so the rows can add to it. */
  total: string;
  /** The hide control's state, honoured here too: a hidden balance has hidden parts. */
  hidden: boolean;
  /** The code the headline is in. Printed on each row so the units are never guessed. */
  currency: string;
}
