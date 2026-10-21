import type { HomeAction } from './HomeActions.constants';

export interface HomeActionsProps {
  /**
   * Which set to draw. Home shows both actions; the same pair is reused anywhere
   * a surface needs the account's two doors, so the list is data rather than
   * markup.
   */
  actions?: HomeAction[];
}

export interface HomeActionProps {
  action: HomeAction;
}
