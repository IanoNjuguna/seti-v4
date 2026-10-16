import type { NoIdentityView } from '@/components/app/no-account.types';

export interface BalanceNoteProps {
  /** Never `signed-in`: the state that HAS a figure renders `BalanceFigure`. */
  view: NoIdentityView;
}
