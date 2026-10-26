import type { AssetBalanceRow } from '@/lib/api';
import { refusalMessageFor } from '@/lib/api/refusal.constants';
import { formatFiat } from '@/lib/formatCurrency';
import { COVERAGE_REFUSAL } from '@/lib/pay/quote-asset';
import { TOKEN_SELECTOR_COPY } from './TokenSelector.constants';
import type { TokenOption, TokenRefusal, TokenSelectorModel } from './TokenSelector.types';

/** What the selector is built from: the balance rows, and the two choices made about them. */
export interface TokenSelectorInput {
  /** One row per asset the chain lists, as the home read answers them. */
  rows: readonly AssetBalanceRow[];
  /** The currency the rows are valued in. Empty until the read has answered. */
  currency: string;
  loading: boolean;
  unavailable: boolean;
  /** The asset the current price spends, or null while nothing is priced. */
  priced: string | null;
  /** The token the customer pinned, or null while the server chooses. */
  pinned: string | null;
  /** The token the server said would cover, after a refused pin. */
  offer: string | null;
}

/**
 * A balance with nothing in it cannot pay, so it is not an option. It is still drawn
 * by home, where it explains the total; here it would be a row that cannot be chosen.
 */
function isFunded(row: AssetBalanceRow): boolean {
  const amount = Number(row.amount);
  return Number.isFinite(amount) && amount > 0;
}

/**
 * The selector's state, derived once (#228).
 *
 * Three rules, and they are the whole feature:
 *
 *  1. **The default is the row that covers**, and it is not a choice this code
 *     makes — the price already names it, because an unpinned quote spends the
 *     asset the server resolved (`pickSpendAsset`). So the selector READS the
 *     answer, which is what makes "defaulted to the row that covers" true of the
 *     signed transfer rather than only of the label.
 *  2. **A pin outlives the price it was made for.** The customer's choice is fed
 *     back into every quote, so the fee line and the amount priced are for THAT
 *     token; when it cannot cover, the preview refuses instead of silently
 *     switching (#223), which is exactly why this control is safe to add.
 *  3. **The refusal is offered only when it can be acted on.** #223's sentence is
 *     rendered for a pinned token that cannot cover WHILE another can, with the
 *     server's own answer naming that other token. When no single balance covers,
 *     there is nothing to offer, and the sentence is shown on its own by the step.
 *
 * Nothing here computes a fee, a coverage verdict or a token amount: the fee is
 * `backend/src/services/fees.ts`, coverage is the preview's, and the figures are the
 * rows' own values formatted in the customer's currency.
 */
export function buildTokenSelector(input: TokenSelectorInput): TokenSelectorModel {
  const options: TokenOption[] =
    input.currency === ''
      ? []
      : input.rows.filter(isFunded).map((row) => ({
          asset: row.asset,
          symbol: row.symbol,
          held: formatFiat(Number(row.value), input.currency),
        }));

  const find = (asset: string | null): TokenOption | null =>
    options.find((option) => option.asset === asset) ?? null;

  const paying = find(input.priced) ?? find(input.pinned) ?? (options.length === 1 ? options[0] : null);
  const offer = find(input.offer);
  const refusal: TokenRefusal | null =
    input.pinned !== null && offer !== null && offer.asset !== input.pinned
      ? { sentence: refusalMessageFor(COVERAGE_REFUSAL), offer }
      : null;

  return {
    options,
    paying,
    pinned: input.pinned,
    choosable: options.length > 1,
    loading: input.loading,
    unavailable: input.unavailable,
    refusal,
  };
}

/** The one line the selector draws when it is not open. Null means: draw nothing. */
export function selectorLine(
  model: TokenSelectorModel
): { label: string; detail: string } | null {
  if (model.paying) {
    return {
      label: `${TOKEN_SELECTOR_COPY.payingFrom} ${model.paying.symbol}`,
      detail: `${TOKEN_SELECTOR_COPY.holds} ${model.paying.held}`,
    };
  }

  if (!model.choosable) return null;

  return {
    label: TOKEN_SELECTOR_COPY.choose,
    detail: TOKEN_SELECTOR_COPY.balanceCount(model.options.length),
  };
}
