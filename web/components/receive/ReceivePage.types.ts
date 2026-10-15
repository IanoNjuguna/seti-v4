export type ReceiveView = 'name' | 'address';

export interface ReceiveSwitchProps {
  /** Which half the page is showing. Comes from the URL, never from local state. */
  view: ReceiveView;
}
