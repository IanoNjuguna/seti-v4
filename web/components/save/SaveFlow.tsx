'use client';

import { useState } from 'react';
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
 * step behind `Add money`.
 *
 * Three states and never two at once: reading (figure only), typing an amount (the
 * figure is replaced, because the customer is now answering a question), and done
 * (the confirmation, with the figure again underneath once it reloads).
 *
 * The page decides which state from the hook and nothing else, so "which screen am
 * I on" is one boolean, not a router.
 */
export function SaveFlow() {
  const save = useSave();
  const [adding, setAdding] = useState(false);

  const currency = save.summary?.fiatCurrency ?? '';

  if (save.deposited) {
    return (
      <div className="flex flex-col gap-4">
        <PageBack />
        <Text variant="section" as="h1">
          {SAVE_COPY.title}
        </Text>

        <div className="rounded-md border border-hairline-light bg-surface-soft px-5 py-6">
          <Text variant="micro" color="secondary" as="p">
            {SAVE_COPY.deposited}
          </Text>
          <Text variant="balance" tabular as="p" className="mt-1 block">
            {formatFiat(Number(save.deposited.fiatAmount), currency)}
          </Text>
          <Text variant="micro" color="secondary" as="p" className="mt-2">
            {SAVE_COPY.depositedBody}
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

      {adding ? (
        <SaveAmount
          currency={currency}
          amount={save.amountFiat}
          quote={save.quote}
          status={save.status}
          error={save.error}
          canSubmit={save.canSubmit}
          spendableFiat={save.summary?.spendableFiat ?? '0.00'}
          onAmount={save.setAmount}
          onSubmit={save.submit}
          onCancel={() => setAdding(false)}
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

          <SaveActions canWithdraw={Boolean(save.summary?.canWithdraw)} onAdd={() => setAdding(true)} />
        </>
      )}
    </div>
  );
}
