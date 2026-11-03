/**
 * The footer's shapes.
 *
 * Every one of them is a plain data type: the footer reads its words, its index
 * and its ledger from `LandingFooter.constants.ts`, so a component here never
 * carries copy of its own.
 */

/** One line of the footer's statement, already split by a person, not by CSS. */
export type FooterLine = string;

/** The statement's props. `lines` is required: the split is an editorial decision. */
export interface FooterStatementProps {
  lines: readonly FooterLine[];
}

/** One row of the footer's ledger: a label, and the one word that answers it. */
export interface FooterFact {
  label: string;
  value: string;
}

export interface FooterFactsProps {
  facts: readonly FooterFact[];
}

/**
 * One row of the footer's index.
 *
 * `id` is a BAND's own id (`#how`, `#fees`), and `label` is the band's own word for
 * itself. They are not invented here, because an index that renames what it points
 * at is worse than no index.
 */
export interface FooterIndexRow {
  id: string;
  label: string;
}

export interface FooterIndexProps {
  rows: readonly FooterIndexRow[];
}

/** The three legal links, which are a `LandingLink` list like the nav's. */
export interface FooterLegalProps {
  links: readonly { label: string; href: string }[];
}
