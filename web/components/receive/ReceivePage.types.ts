export type ReceiveView = 'name' | 'address' | 'merchant';

export interface ReceiveSwitchProps {
  /** Which half the page is showing. Comes from the URL, never from local state. */
  view: ReceiveView;
  /**
   * The halves this account actually has, in the order they are offered.
   *
   * The merchant half is CONDITIONAL: it exists only once a business name is
   * claimed, and a tab that leads to "you have no business name yet" is a tab that
   * punishes the customer for looking. The page knows the handles, so the page
   * decides the list.
   */
  views: ReceiveView[];
}
