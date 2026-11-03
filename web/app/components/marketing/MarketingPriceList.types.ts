import type { MarketingPriceLine } from './Marketing.types';

export interface MarketingPriceListProps {
  /** The price lines, in the order the reader meets them. */
  rows: MarketingPriceLine[];
  /** True where the list sits on `canvas-dark`, and every ink and hairline inverts. */
  onDark?: boolean;
}
