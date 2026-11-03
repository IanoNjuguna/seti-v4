import type { MarketingStep } from './Marketing.types';

export interface MarketingStepListProps {
  steps: MarketingStep[];
  /** True where the list sits on `canvas-dark`, and every ink and hairline inverts. */
  onDark?: boolean;
}
