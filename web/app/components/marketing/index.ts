/**
 * The marketing shell's public surface: the frame, a masthead, a band, the four row shapes,
 * and the close. A route imports from here and nowhere deeper, so a component can be split
 * or renamed without touching a page.
 */
export { MarketingShell } from './MarketingShell';
export { MarketingHeader } from './MarketingHeader';
export { MarketingMasthead } from './MarketingMasthead';
export { MarketingBand } from './MarketingBand';
export { MarketingPriceList } from './MarketingPriceList';
export { MarketingRowList } from './MarketingRowList';
export { MarketingStepList } from './MarketingStepList';
export { MarketingStatementList } from './MarketingStatementList';
export { MarketingClose } from './MarketingClose';
export { MarketingBreadcrumb } from './MarketingBreadcrumb';

export type {
  MarketingPriceLine,
  MarketingRow,
  MarketingStatement,
  MarketingStep,
} from './Marketing.types';
export type { MarketingMastheadCopy } from './MarketingMasthead.types';
export type { MarketingCloseLink } from './MarketingClose.types';
