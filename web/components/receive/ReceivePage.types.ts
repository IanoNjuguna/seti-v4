/**
 * The two receive halves. A person's account has ONE of them; a business has both.
 *
 * `'address'` used to be here — a Tempo address for a wallet outside Seti — and it
 * is gone by the owner's instruction: the page now sends money reachable by
 * username only. The member is deleted rather than hidden so a stale `?view=address`
 * URL cannot resolve to a view the page no longer knows how to draw.
 */
export type ReceiveView = 'name' | 'merchant';

export interface ReceiveSwitchProps {
  /** Which half the page is showing. Comes from the URL, never from local state. */
  view: ReceiveView;
  /**
   * The halves this account actually has, in the order they are offered.
   *
   * The merchant half is CONDITIONAL: it exists only once a business name is claimed,
   * and a tab that leads to "you have no business name yet" is a tab that punishes the
   * customer for looking. The page knows the handles, so the page decides the list —
   * and it renders no switch at all when the list has one member, because a
   * one-option switch is decoration that reads as broken.
   */
  views: ReceiveView[];
}
