'use client';

import { PageBack } from '@/components/app/PageBack';
import { Button, Text } from '@/components/ui';
import { formatFiat } from '@/lib/formatCurrency';
import { useSave } from '@/hooks/useSave';
import { SAVE_COPY } from './Save.constants';
import { SaveActions } from './SaveActions';
import { SaveAmount } from './SaveAmount';
import { SaveFigure } from './SaveFigure';

/**
 * The Save page, in Cash App's shape: the figure, the two actions, and the amount
 * step behind both of them.
 *
 * Three states and never two at once: reading (figure only), typing an amount (the
 * figure is replaced, because the customer is now answering a question), and done
 * (the confirmation, with the figure again underneath once it reloads).
 *
 * The direction lives in the hook's `mode`, not in this component: `Add money` and
 * `Withdraw` open the same sheet with the same field, and the page must not be able
 * to show one while pricing the other.
 */
export function SaveFlow() {
  const save = useSave();

  const currency = save.summary?.fiatCurrency ?? '';
  const withdrawReason = !save.summary?.canWithdraw
    ? save.summary?.vault
      ? SAVE_COPY.withdrawUnavailable
      : null
    : null;

  /*
   * Closed beats everything: while saving is off there is no figure to read, no amount
   * to type and no button to press, because every one of those would imply a deposit
   * the API now refuses with 503. The page still renders, so a shared link lands
   * somewhere honest instead of a 404.
   */
  if (save.summary !== null && save.summary.live === false) {
    return (
      <div className="flex flex-col gap-4">
        <PageBack />
        <Text variant="section" as="h1">
          {SAVE_COPY.title}
        </Text>

        <div className="rounded-md border border-hairline-light bg-surface-soft px-5 py-6">
          <Text variant="micro" color="secondary" as="p">
            {SAVE_COPY.soonLabel}
          </Text>
          <Text variant="card-title" as="h2" className="mt-1">
            {SAVE_COPY.soonHeadline}
          </Text>
          <Text variant="body" color="secondary" as="p" className="mt-2">
            {SAVE_COPY.soonBody}
          </Text>
          <Text variant="micro" color="secondary" as="p" className="mt-3">
            {SAVE_COPY.soonNote}
          </Text>
        </div>
      </div>
    );
  }

  if (save.done) {
    return (
      <div className="flex flex-col gap-4">
        <PageBack />
        <Text variant="section" as="h1">
          {SAVE_COPY.title}
        </Text>

        <div className="rounded-md border border-hairline-light bg-surface-soft px-5 py-6">
          <Text variant="micro" color="secondary" as="p">
            {save.done.mode === 'add' ? SAVE_COPY.deposited : SAVE_COPY.withdrawn}
          </Text>
          <Text variant="balance" tabular as="p" className="mt-1 block">
            {formatFiat(Number(save.done.fiatAmount), currency)}
          </Text>
          <Text variant="micro" color="secondary" as="p" className="mt-2">
            {save.done.mode === 'add' ? SAVE_COPY.depositedBody : SAVE_COPY.withdrawnBody}
          </Text>
        </div>

        <Button type="button" fullWidth onClick={save.dismiss}>
          {SAVE_COPY.done}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageBack />
      <Text variant="section" as="h1">
        {SAVE_COPY.title}
      </Text>

      {save.mode ? (
        <SaveAmount
          mode={save.mode}
          currency={currency}
          amount={save.amountFiat}
          quote={save.quote}
          status={save.status}
          error={save.error}
          canSubmit={save.canSubmit}
          spendableFiat={save.summary?.spendableFiat ?? '0.00'}
          savedFiat={save.summary?.savedFiat ?? '0.00'}
          onAmount={save.setAmount}
          onSubmit={save.submit}
          onCancel={save.reset}
        />
      ) : (
        <>
          <SaveFigure summary={save.summary} loading={save.loading} />

          {save.summary?.status === 'ok' && save.summary.vault?.depositsPaused ? (
            <Text variant="micro" color="warning" as="p">
              {SAVE_COPY.paused}
            </Text>
          ) : null}

          {save.error ? (
            <Text variant="micro" color="alert" as="p" role="alert">
              {save.error}
            </Text>
          ) : null}

          <SaveActions
            canWithdraw={Boolean(save.summary?.canWithdraw)}
            withdrawReason={withdrawReason}
            onAdd={() => save.setMode('add')}
            onWithdraw={() => save.setMode('withdraw')}
          />
        </>
      )}
    </div>
  );
}
