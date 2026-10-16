/**
 * Types shared by more than one landing section.
 *
 * There is no `Text`-based variant scale for marketing copy here: the display
 * and caption roles this page uses (`display-xxl`/`display-md`/`body-lg`/
 * `caption`) are not in the `Text` primitive's variant set, which covers the
 * product's UI roles. So the landing sections set those roles with the design
 * system's own token classes on semantic elements — still tokens, never a raw
 * value — and use the primitives wherever a variant does fit.
 */

/** A label/detail row — the page's one repeating rhythm, hairline separated. */
export interface LandingRow {
  label: string;
  detail: string;
}

/** A link in the nav or the footer. */
export interface LandingLink {
  label: string;
  href: string;
}

/** A section the ⌘K palette can jump to, including the hero. */
export interface SearchSection {
  id: string;
  label: string;
  keywords: string;
}
