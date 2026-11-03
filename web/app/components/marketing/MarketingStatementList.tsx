import type { MarketingStatementListProps } from './MarketingStatementList.types';

/**
 * Sentences with no titles between them: the three refusals on `/pricing`.
 *
 * NO ITEM GETS AN h3, because each one IS the statement. There is no name for "We are not
 * the cheapest way to send money to Kenya. Wise is." that is not that sentence again, and a
 * heading invented to satisfy the outline would be a heading with nothing under it.
 *
 * `text-body-lg` IS THE LEDE'S SIZE, because this band is an argument rather than a list of
 * items: the reader is being told what they are not buying, and it has to weigh as much as
 * the price above it.
 */
export function MarketingStatementList({ statements }: MarketingStatementListProps) {
  return (
    <ul className="max-w-2xl">
      {statements.map((statement) => (
        <li
          key={statement.text}
          className="border-t border-hairline-light py-6 text-body-lg text-mute first:border-t-0 first:pt-0"
        >
          {statement.text}
        </li>
      ))}
    </ul>
  );
}
