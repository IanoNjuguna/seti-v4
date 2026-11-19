import { RATE_UNAVAILABLE } from './ConvertCalculator.constants';

/**
 * The state the page shows when there is no rate (#586).
 *
 * A CONVERTER WITH NO RATE MUST NOT CONVERT. The tempting alternative is a bundled default
 * figure so the page always has a number, and that is the defect this component exists to
 * refuse: a stale figure shown as today's is a money claim the code cannot support, and the
 * reader has no way to tell it apart from a live one.
 *
 * It is not a skeleton, either. A skeleton claims data is coming; this says it did not
 * arrive and what to do about it, which is the honest reading of the same moment
 * (`design-enforcement`'s rule for a surface with no data behind it).
 */
export function ConvertUnavailable() {
  return (
    <div className="rounded-lg border border-hairline-light bg-surface-soft p-6">
      <p className="text-body-md-bold text-ink">{RATE_UNAVAILABLE.title}</p>
      <p className="mt-2 text-body-sm text-mute">{RATE_UNAVAILABLE.body}</p>
    </div>
  );
}
