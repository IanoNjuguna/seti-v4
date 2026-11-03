'use client';

import { SWAP_FORM_COPY } from './SwapForm.constants';
import { SwapAmountField } from './SwapAmountField';
import { SwapFigures } from './SwapFigures';
import { SwapSelect } from './SwapSelect';
import { SwapSubmit } from './SwapSubmit';
import type { SwapFieldsProps } from './SwapForm.types';

/**
 * The four things a swap is made of, in the order they are decided.
 *
 * Which balance, then which to hold, then how much, then the two figures and the one
 * control that signs. The ORDER is the page's argument: the target list comes from the
 * chosen source, the amount is checked against the chosen balance, and the floor and the
 * fee sit directly under the amount they belong to and above the button that signs them,
 * so both are read on the way to the signature rather than after it.
 *
 * It takes the hook's state whole rather than a dozen props, because every control here
 * is wired to the same one thing and splitting the object up would only be a longer way
 * of saying so. Nothing here decides anything: the pickers' options, the amount's message,
 * whether a quote is shown and whether the button can be pressed are all the hook's.
 */
export function SwapFields({ form }: SwapFieldsProps) {
  return (
    <form className="flex flex-col gap-4" onSubmit={form.onSubmit}>
      <SwapSelect
        id={form.sourceFieldId}
        label={SWAP_FORM_COPY.sourceLabel}
        value={form.assetIn}
        options={form.sourceOptions}
        disabled={form.busy}
        onChoose={form.onSource}
      />

      <SwapSelect
        id={form.targetFieldId}
        label={SWAP_FORM_COPY.targetLabel}
        value={form.assetOut}
        options={form.targetOptions}
        disabled={form.busy}
        onChoose={form.onTarget}
      />

      <SwapAmountField
        id={form.amountFieldId}
        amount={form.amount}
        error={form.amountError}
        busy={form.busy}
        refocus={form.refocusAmount}
        onAmount={form.onAmount}
        onAll={form.onAll}
      />

      {form.quote !== null && <SwapFigures quote={form.quote} />}

      <SwapSubmit
        busy={form.busy}
        done={form.done}
        disabled={!form.canSubmit}
        onReset={form.onReset}
      />
    </form>
  );
}
