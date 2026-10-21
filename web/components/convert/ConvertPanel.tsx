'use client';

import { useUserCurrency } from '@/hooks/useUserCurrency';
import { CONVERT_COPY, convertSymbol, formatFigure } from './Convert.constants';
import { ConvertAction } from './ConvertAction';
import { ConvertField } from './ConvertField';
import { ConvertFlip } from './ConvertFlip';
import { ConvertNote } from './ConvertNote';
import type { ConvertPanelProps } from './Convert.types';

/**
 * The convert, on one screen: two rows, the flip between them, the line under
 * them, and the button.
 *
 * Nothing here decides a figure. The receive row shows `fiatAmountOut` from the
 * server and the note shows the server's floor; the only thing the panel adds is
 * formatting and the currency word, which comes from the customer's own account
 * (`useUserCurrency`) so a page that has not quoted yet still names KES rather
 * than guessing a currency.
 *
 * The receive field is `readOnly` and the customer cannot type into it: what
 * arrives is the book's answer, not theirs to choose. The flip is the only way to
 * change the pair, and it clears the amount because a figure typed for one pair is
 * not an amount of the other.
 */
export function ConvertPanel({ convert }: ConvertPanelProps) {
  const {
    assetIn,
    assetOut,
    sources,
    targets,
    amountFiat,
    preview,
    status,
    error,
    quoting,
    canSubmit,
    setAmount,
    setAssetIn,
    setAssetOut,
    flip,
    submit,
  } = convert;

  // The preview states the currency it priced in; before the first quote the
  // account's own currency is the honest label.
  const accountCurrency = useUserCurrency(preview === null);
  const currency = preview?.fiatCurrency ?? accountCurrency ?? '';

  // Bare figures: the currency is the chip at the left of each field, and a
  // `formatFiat` figure there would print the code twice ("KES  KES 999.88").
  const received = preview ? formatFigure(preview.fiatAmountOut) : '';
  const floor = preview
    ? CONVERT_COPY.floorTemplate
        .replace('{floor}', formatFigure(preview.minAmountOut))
        .replace('{symbol}', convertSymbol(assetOut))
    : undefined;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <ConvertField
        label={CONVERT_COPY.giveLabel}
        id={CONVERT_COPY.amountInputId}
        amount={amountFiat}
        onAmountChange={setAmount}
        placeholder={CONVERT_COPY.amountPlaceholder}
        currencyPrefix={currency}
        asset={assetIn}
        assets={sources}
        onAssetChange={setAssetIn}
        selectLabel={CONVERT_COPY.sourceSelectLabel}
        hint={preview && !preview.hasEnoughBalance ? CONVERT_COPY.noBalance : undefined}
      />

      <ConvertFlip onClick={flip} label={CONVERT_COPY.flipLabel} icon="convert" />

      <ConvertField
        label={CONVERT_COPY.getLabel}
        id={CONVERT_COPY.receivedInputId}
        amount={received}
        readOnly
        currencyPrefix={currency}
        asset={assetOut}
        assets={targets.length > 0 ? targets : [assetOut]}
        onAssetChange={setAssetOut}
        selectLabel={CONVERT_COPY.targetSelectLabel}
        hint={floor}
      />

      <ConvertNote preview={preview} assetOut={assetOut} quoting={quoting} error={error} />

      <ConvertAction status={status} canSubmit={canSubmit} onConvert={submit} />
    </form>
  );
}
