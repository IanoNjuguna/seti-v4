import type { ReactNode } from 'react';

export interface BandProps {
  /** The section anchor the nav and the ⌘K palette jump to. */
  id?: string;
  /** Canvas and vertical rhythm for the band this section occupies. */
  className?: string;
  children: ReactNode;
}
