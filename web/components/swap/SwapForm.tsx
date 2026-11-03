'use client';

import { Skeleton, Text } from '@/components/ui';
import { PageBack } from '@/components/app/PageBack';
import { useSwapForm } from '@/hooks/useSwapForm';
import { SWAP_FORM_COPY } from './SwapForm.constants';
import { SwapFields } from './SwapFields';
import { SwapStateLine } from './SwapStateLine';

/**
 * The swap page: the title, the shape while the balances are read, and one state line.
 *
 * The figures and the controls are `SwapFields`; this file owns what every state of the
 * page has in common, so a visitor, a customer mid-request and a customer whose read
 * failed all see the same heading and the same way back rather than three different
 * screens. Reading is a SHAPE — two bars the height of the two pickers — so nothing jumps
 * when the real controls arrive.
 *
 * The state line is one sentence and it sits under the controls, where the answer to
 * "what happened" belongs, and it is the only place a refusal is read: the field carries
 * only what is wrong with the figure typed into it.
 */
export function SwapForm() {
  const form = useSwapForm();

  return (
    <div className="flex flex-col gap-4">
      <PageBack />
      <Text variant="section" as="h1">
        {SWAP_FORM_COPY.title}
      </Text>
      <Text variant="body" color="secondary" as="p">
        {SWAP_FORM_COPY.lead}
      </Text>

      {form.loading && (
        <>
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </>
      )}

      {form.ready && <SwapFields form={form} />}

      {form.stateLine !== null && (
        <SwapStateLine tone={form.stateLine.tone} sentence={form.stateLine.sentence} />
      )}
    </div>
  );
}
