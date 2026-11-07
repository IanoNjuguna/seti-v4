'use client';

import { Text } from '@/components/ui';
import { formatFiat } from '@/lib/formatCurrency';
import { formatAssetUnits } from '@/components/home/home.format';
import { SWAP_FIGURE_CLASS, SWAP_FORM_COPY, SWAP_LINK_CLASS, SWAP_PANEL_CLASS } from './SwapForm.constants';
import { SwapAmountField } from './SwapAmountField';
import { SwapCard } from './SwapCard';
import { SwapFigures } from './SwapFigures';
import { SwapFlipControl } from './SwapFlipControl';
import { SwapSubmit } from './SwapSubmit';
import type { SwapFieldsProps } from './SwapForm.types';

/**
 * The pair, then the two figures it promises, then the one control that signs.
 *
 * The order is the page's argument (#417): what you are spending, what you are getting, one
 * button between them to turn it over, then the floor and the fee directly under the pair
 * they belong to and above the control that signs. It used to be four stacked form fields
 * with two captions and a ceiling floating on its own row, which read as a settings page.
 *
 * Nothing here decides anything: the options, the amount, the get figure, whether the flip
 * is possible and whether the button can be pressed are all `useSwapForm`'s. The get figure
 * is `quote.amountOut`, which the server computed; this file does no arithmetic on a quote.
 */
export function SwapFields({ form }: SwapFieldsProps) {
  // Symbols and units come from the rows the quote is spending and buying, never typed
  // here: a token name this app made up is a token name we claimed.
  const source = form.sourceOptions.find((option) => option.asset === form.assetIn);
  const quote = form.quote;

  return (
    <form className="flex flex-col gap-4" onSubmit={form.onSubmit}>
      {/*
        ONE panel, two zones, one divider (#421). The flip control is centred on that divider
        and straddles it, which is the reference shape expressed in this product's own
        surface. The zones' `pb-7` / `pt-7` are the button's clearance: 28px against its 22px
        half-height, so it can never cover the balance row above it or the label below.
      */}
      <div className={SWAP_PANEL_CLASS}>
        <div className="pb-7">
          <SwapCard
            selectId={form.sourceFieldId}
            label={SWAP_FORM_COPY.payLabel}
            asset={form.assetIn}
            options={form.sourceOptions}
            busy={form.busy}
            onChoose={form.onSource}
            figure={
              <SwapAmountField
                id={form.amountFieldId}
                label={SWAP_FORM_COPY.amountAria}
                amount={form.amount}
                error={form.amountError}
                busy={form.busy}
                refocus={form.refocusAmount}
                onAmount={form.onAmount}
              />
            }
            footer={
              <>
                <Text variant="micro" as="span" color="secondary" tabular>
                  {SWAP_FORM_COPY.balanceLabel} {source?.units ?? ''} {source?.symbol ?? ''}
                </Text>

                {/* The server's `max` is what this fills, so it stays unavailable until that
                    answer exists: a control that filled a figure we derived ourselves would
                    overstate the spendable balance by exactly the fee the swap also costs. */}
                <button
                  type="button"
                  className={SWAP_LINK_CLASS}
                  onClick={form.onAll}
                  disabled={form.busy || form.spendable === null}
                >
                  {SWAP_FORM_COPY.max}
                </button>
              </>
            }
          />
        </div>

        <div className="relative border-t border-hairline-light">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
            <SwapFlipControl disabled={!form.canFlip || form.busy} onFlip={form.onFlip} />
          </div>
        </div>

        <div className="pt-7">
          <SwapCard
            selectId={form.targetFieldId}
            label={SWAP_FORM_COPY.getLabel}
            asset={form.assetOut}
            options={form.targetOptions}
            busy={form.busy}
            onChoose={form.onTarget}
            figure={
              <span className={SWAP_FIGURE_CLASS}>
                {quote === null ? '' : formatAssetUnits(quote.amountOut)}
              </span>
            }
            footer={
              <Text variant="micro" as="span" color="secondary" tabular>
                {quote === null
                  ? ''
                  : `≈ ${formatFiat(Number(quote.fiatAmountOut), quote.fiatCurrency)}`}
              </Text>
            }
          />
        </div>
      </div>

      {quote !== null && <SwapFigures quote={quote} />}

      <SwapSubmit
        busy={form.busy}
        done={form.done}
        disabled={!form.canSubmit}
        onReset={form.onReset}
      />
    </form>
  );
}
