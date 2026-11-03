import type { MarketingRowListProps } from './MarketingRowList.types';

/**
 * Named things in a column: an h3 for the name, one sentence under it, a hairline between.
 *
 * THE ITEM IS AN h3 BECAUSE THE BAND'S h2 CANNOT REACH IT OTHERWISE. "A Lipa na M-Pesa till"
 * is what the sentence under it is about, and a reader who lands on the band from a search
 * result should meet the three names it covers before reading any figure.
 *
 * HAIRLINES, NOT CARDS, and the same rhythm the landing's step lists use (`HowSection`,
 * `SetupSection`): `border-t` on every row but the first, `max-w-2xl` so a sentence stays a
 * sentence. A card around a two-line row is furniture that says "product tile" about a
 * comparison the reader is making in their head.
 *
 * `key` IS THE TITLE, not the index: the titles are the identity of the rows here, and a
 * key that moves with the array order is how a row's state follows the wrong row later.
 */
export function MarketingRowList({ rows }: MarketingRowListProps) {
  return (
    <ul className="max-w-2xl">
      {rows.map((row) => (
        <li
          key={row.title}
          className="border-t border-hairline-light py-7 first:border-t-0 first:pt-0"
        >
          <h3 className="font-brand text-heading-sm font-medium text-ink">{row.title}</h3>
          <p className="mt-2 text-body-md text-mute">{row.detail}</p>
        </li>
      ))}
    </ul>
  );
}
