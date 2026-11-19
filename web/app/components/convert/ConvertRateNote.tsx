import { formatShillings } from './convert.math';
import { formatPublicationDay } from './convert.format';
import {
  NOT_A_QUOTE,
  RATE_NOTE_PREFIX,
  RATE_SOURCE_COPY,
  RATE_STALE,
} from './ConvertCalculator.constants';
import type { ConvertRateNoteProps } from './ConvertCalculator.types';

/**
 * The rate, and who published it (#586).
 *
 * THREE THINGS A READER NEEDS AND A TRENDY CONVERTER OMITS: the figure, the publisher, and
 * the day it applies to. All three come from the API response, not from a constant in the
 * bundle, so a page that renders this block is a page whose number has provenance.
 *
 * The day is formatted from the publisher's own `YYYY-MM-DD` string (see
 * `convert.format.ts`), never from a clock. When the publisher is not the Bank, the note
 * says which publisher it is instead of borrowing the Bank's name: a fallback rate
 * presented as the Central Bank's would be the one lie this page cannot afford.
 */
export function ConvertRateNote({ fiatPerUsd, source, publishedFor, stale }: ConvertRateNoteProps) {
  const sourceName = RATE_SOURCE_COPY[source] ?? 'a published rate';
  const day = formatPublicationDay(publishedFor);

  return (
    <div className="flex flex-col gap-2">
      <p className="font-tabular text-body-md text-ink">
        {RATE_NOTE_PREFIX} {formatShillings(fiatPerUsd)}
      </p>
      <p className="text-caption text-mute">
        {sourceName}
        {day ? `, ${day}` : ''}. {NOT_A_QUOTE}
      </p>
      {stale ? <p className="text-caption text-ink-attention">{RATE_STALE}</p> : null}
    </div>
  );
}
