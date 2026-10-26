import { COVERAGE_REFUSAL } from '@/lib/pay/quote-asset';
import type { TokenSelectorModel } from '@/components/token-selector/TokenSelector.types';
import type { SendFormFlags } from './SendPanel.types';

/**
 * What the send form still has to say, as one pure function (#232).
 *
 * `no-single-asset-covers` is the ONE refusal a second surface can draw, and the
 * token selector is that surface: the sentence belongs beside the balance that can
 * pay it, which is where the way out is. Drawing it on the form as well would put
 * the same sentence twice on one screen, the second time with no offer under it.
 *
 * The suppression is conditional on the selector actually DRAWING it. A refusal
 * with no offer (the money is spread across balances, and no single one covers)
 * leaves the selector's refusal empty, and then the form is the only place the
 * customer can read what happened, so it says so. Silently suppressing on the code
 * alone is how a refused send becomes a button that appears to do nothing.
 */
export function sendFormFlags(input: {
  formError: string | null;
  formErrorCode: string | null;
  tokenSelector: TokenSelectorModel;
}): SendFormFlags {
  const drawnBySelector =
    input.formErrorCode === COVERAGE_REFUSAL && input.tokenSelector.refusal !== null;

  return { formError: drawnBySelector ? null : input.formError };
}
