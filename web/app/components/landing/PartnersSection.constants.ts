import type { PartnerEntry, PartnerState } from './PartnersSection.types';

/** The section marker, set in caption size by `SectionEyebrow`. */
export const PARTNERS_EYEBROW = 'Integrations';

/**
 * The per-tile state caption. All four marks share one row now, so position can
 * no longer group them into connected and not-connected the way the old stacked
 * groups did; each mark states its own state instead. "In use now" and "Not in
 * use yet" are the same two words the other way round, so the contrast reads
 * without colour or an icon, and neither phrasing can be mistaken for a service
 * that is available.
 */
export const PARTNER_STATE_LABELS: Record<PartnerState, string> = {
  live: 'In use now',
  soon: 'Not in use yet',
};

/**
 * The integrations, in the order the stack is layered: the chain, then sign-in,
 * then the fiat rails. Add a fifth by adding a line here — the grid reflows, and
 * nothing else on the page needs to change.
 *
 * EVERY MARK IS THE KIT'S OWN WHITE VARIANT. `design-kit/` is the brand source
 * of truth and it already held the dark-background mark for each name, so each
 * one was copied into `web/public/` as shipped rather than inverted or
 * re-coloured here — hand-making a light variant is how a kit ends up with three
 * versions of one asset. Served file → the kit path it was copied from:
 *
 *   /tempo-wordmark-white.svg   design-kit/Tempo/Wordmark/tempo-white.svg
 *   /privy-wordmark-white.svg   design-kit/Privy/Privy_Wordmark_White.svg
 *   /stripe-wordmark-white.svg  design-kit/Stripe/asset-wordmark/Stripe wordmark - White.svg
 *   /bridge-logo-white.svg      design-kit/Bridge/Logo/676f68fb0dcc0518dabd8fdb_Co-branded-Bridge-Stripe-Vertical-Small-trans.svg
 *
 * BRIDGE IS THE ONE ENTRY THE KIT CANNOT FILL OUTRIGHT. The only Bridge asset in
 * the kit is a co-branded Bridge + Stripe lockup drawn for a light page: black
 * artwork, with the endorsement line "a stripe company" under the Bridge word.
 * Bridge therefore has no standalone mark to use, and the lockup puts "stripe" in
 * two tiles — this one and Stripe's own. That overlap is the owner's decision,
 * not an oversight; the section's doc comment records it and the two alternatives
 * that were weighed. Nothing was fetched from outside the kit, and the mark was
 * not redrawn to dodge the overlap.
 *
 * The Bridge copy is the kit's own artwork with one edit, and it is an edit of
 * colour only: its nine `fill="black"` paths became `fill="#FFFFFF"`, which
 * whitens the whole of its vector artwork. That edit cannot reach the rest of the
 * mark, because most of it is a BITMAP embedded in the SVG — hence
 * `hasEmbeddedBitmap`, which adds a filter on the `<img>` for the part a fill
 * cannot touch. The kit file itself is untouched.
 */
export const PARTNER_ENTRIES: PartnerEntry[] = [
  { label: 'Tempo', state: 'live', mark: '/tempo-wordmark-white.svg' },
  { label: 'Privy', state: 'live', mark: '/privy-wordmark-white.svg' },
  { label: 'Bridge', state: 'soon', mark: '/bridge-logo-white.svg', hasEmbeddedBitmap: true },
  { label: 'Stripe', state: 'soon', mark: '/stripe-wordmark-white.svg' },
];
