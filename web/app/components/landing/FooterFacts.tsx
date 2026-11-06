import { cn } from '@/lib/cn';
import type { FooterFactsProps } from './LandingFooter.types';

/**
 * The footer's ledger: three questions a merchant asks about money, each answered in
 * one word, right-aligned so every answer lands on the same edge.
 *
 * `dl` and not three `<p>`s, because these are termin-value pairs and a screen
 * reader should read them as such. The figures are `font-tabular` — the design
 * system's rule for anything numeric — so the fee's answer sits in the mono face with the
 * rest of the page's numbers rather than in the brand face by accident.
 *
 * THE THREE ANSWERS ARE THE PRODUCT'S OWN FACTS, not a pitch: the fee is 2% flat
 * (`backend/src/services/fees.ts`), there is no monthly fee and no minimum
 * (`FaqSection.constants.ts`), and Seti never holds the money (v1 is non-custodial).
 * "Never" is doing real work next to "None": it is the same claim as the statement to
 * its left, said in the ledger's register.
 */
export function FooterFacts({ facts }: FooterFactsProps) {
  return (
    <dl className="flex flex-col gap-4">
      {facts.map((fact) => (
        <div
          key={fact.label}
          className={cn(
            'flex items-baseline justify-between gap-6 border-b border-divider-soft pb-3 last:border-b-0'
          )}
        >
          <dt className="text-caption text-on-dark-mute">{fact.label}</dt>
          <dd className="font-tabular text-body-md font-semibold text-on-dark">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
