import type { HomeDashboard } from '@/lib/api/home.types';
import type { AuthStatus } from '@/lib/auth';

export interface BalanceCardProps {
  /** The dashboard, for the one state that has one. */
  data: HomeDashboard | null;
  /**
   * Which session state is rendering the card. It decides the card's whole body:
   * a figure exists only for `signed-in`, and the other two states get a
   * sentence instead — never zero, never a placeholder (see `BalanceNote`).
   */
  view: AuthStatus;
  /**
   * A swap from one of the token rows was recorded. Threaded straight through to the
   * rows (#240): the figure above them is now stale, and the screen that owns the read
   * is the only thing that can refresh it.
   */
  onSwapped?: () => void;
}
