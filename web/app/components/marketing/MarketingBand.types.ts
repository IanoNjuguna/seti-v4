import type { ReactNode } from 'react';

export interface MarketingBandProps {
  /**
   * The band's marker, which is also its `h2`. The dictated heading, verbatim — the marker
   * IS the heading on these routes, so nothing is said twice on the way in.
   */
  eyebrow: string;
  children: ReactNode;
}
