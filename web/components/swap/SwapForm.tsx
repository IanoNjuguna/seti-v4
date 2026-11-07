'use client';

import { Skeleton, Text } from '@/components/ui';
import { PageBack } from '@/components/app/PageBack';
import { useSwapForm } from '@/hooks/useSwapForm';
import { SWAP_FORM_COPY } from './SwapForm.constants';
import { SwapFields } from './SwapFields';
import { SwapRateLine } from './SwapRateLine';
import { SwapStateLine } from './SwapStateLine';

/**
 * The swap page: the title, the price of the pair, the shape while balances are read, and
 * one state line.
 *
 * The rate sits directly under the heading (#417), where the category puts it and where a
 * customer checks it before anything else on the screen. It used to sit between the pickers
 * and the amount, attached to neither, and the space above it was spent on a sentence
 * ("Move money from one balance into another.") that said what the title already said.
 *
 * The figures and the controls are `SwapFields`; this file owns what every state of the
 * page has in common, so a visitor, a customer mid-request and a customer whose read failed
 * all see the same heading and the same way back rather than three different screens.
 * Reading is a SHAPE, two cards' worth of skeleton, so nothing jumps when the real controls
 * arrive.
 *
 * The state line is one sentence and it sits under the controls, where the answer to "what
 * happened" belongs, and it is the only place a refusal is read: the field carries only what
 * is wrong with the figure typed into it.
 */
export function SwapForm() {
  const form = useSwapForm();

  return (
    <div className="flex flex-col gap-4">
      <PageBack />
      <Text variant="section" as="h1">
        {SWAP_FORM_COPY.title}
      </Text>

      {form.quote !== null && <SwapRateLine quote={form.quote} />}

      {form.loading && (
        <>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </>
      )}

      {form.ready && <SwapFields form={form} />}

      {form.stateLine !== null && <SwapStateLine {...form.stateLine} />}
    </div>
  );
}
