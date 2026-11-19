import type { ConvertResultProps } from './ConvertCalculator.types';

/**
 * The answer side of the converter (#586).
 *
 * A `dl` is not ceremony here: the label above the figure is the question
 * ("In shillings", "In tokens") and the figure is its answer, which is exactly the pairing
 * the element exists for. A screen reader then reads the pair rather than two unrelated
 * strings, which is what a naked pair of `<p>`s gives you.
 *
 * THE FIGURE ARRIVES FORMATTED, unit included (`KES 3,239.75`, `25.00 pathUSD`). Splitting
 * the unit into its own prop would let a caller print a number and forget which currency it
 * was in, and this page exists to stop exactly that.
 *
 * `font-tabular` on the figure, per `design/revolut.md`: money that changes as the reader
 * types must not shift its own width.
 */
export function ConvertResult({ label, figures }: ConvertResultProps) {
  return (
    <dl className="flex flex-col gap-2">
      <dt className="text-caption text-mute">{label}</dt>
      <dd className="font-tabular text-display-md text-ink">{figures}</dd>
    </dl>
  );
}
