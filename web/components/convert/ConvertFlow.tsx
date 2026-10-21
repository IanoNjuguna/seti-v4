'use client';

import { useConvert } from '@/hooks/useConvert';
import { PageBack } from '@/components/app/PageBack';
import { Text } from '@/components/ui';
import { CONVERT_COPY } from './Convert.constants';
import { ConvertPanel } from './ConvertPanel';
import { ConvertResult } from './ConvertResult';

export interface ConvertFlowProps {
  /** Where Back lands. Home by default. */
  backHref?: string;
}

/**
 * The flow itself: the pair, the amount, and the commit.
 *
 * Mounted only for a customer with an account (see `ConvertScreen`), so every
 * request its hook makes — the balance read, the quote, the signature — belongs
 * to somebody who can actually convert.
 *
 * Two surfaces and never both: the form, or what the convert did. Leaving an
 * editable amount above a result would invite a second convert before the first
 * one was read.
 */
export function ConvertFlow({ backHref }: ConvertFlowProps) {
  const convert = useConvert();

  return (
    <div className="flex flex-col gap-4">
      <PageBack href={backHref} />
      <Text variant="section" as="h1">
        {CONVERT_COPY.title}
      </Text>

      {convert.result ? (
        <ConvertResult result={convert.result} onAgain={convert.reset} />
      ) : (
        <ConvertPanel convert={convert} />
      )}
    </div>
  );
}
