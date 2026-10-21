import type { InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Always rendered and always programmatically linked to the field. */
  label: string;
  /** Small helper line under the field; hidden while an error is shown. */
  hint?: string;
  /**
   * Inline validation copy. design/revolut.md puts field errors in `color-alert` as
   * a caption under the field, so the field owns its own message rather than
   * being reported somewhere else on the screen.
   */
  error?: string;
  /**
   * Which surface the field sits on.
   *
   * The primitive was light-canvas only, so the dark send panel re-implemented it —
   * including its accessibility wiring — which is how two fields end up disagreeing
   * about how a message is announced. The tone swaps the token set and nothing else:
   * the label/message/aria contract is identical on both.
   */
  tone?: 'light' | 'dark';
}
