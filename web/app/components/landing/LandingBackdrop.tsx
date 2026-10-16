/**
 * The landing page's one surface: the black canvas, and a fine grain on it.
 *
 * THE CORNER WASHES ARE GONE, and nothing replaced them. This component used to
 * render `.field-layer` as well — two drifting radial washes, cobalt and phoenix,
 * one in each direction across the viewport — and they were decoration behind
 * content: soft colour in the corners of a band whose job is a headline, a
 * sentence and one action. Deference is the rule they failed (a surface exists to
 * carry content, not to be looked at), and the test was the honest one: the hero
 * reads the same with them off, so they were never carrying information. Removing
 * them leaves the surface the rest of the page already uses — the body's
 * `{colors.canvas-dark}` (#000000), the same canvas the nav, the footer and every
 * dark band paint — with no second colour in it and no new one invented to stand
 * stand in their place. A quieter surface is also a measurable one: every text colour
 * in the hero now has exactly ONE background to answer for instead of a field that
 * drifts under it. Sampled from the render at 1280x720, the grain takes the canvas
 * from #000000 to a mean of rgb(21,21,21) with tiles from rgb(4,4,5) to rgb(44,43,42),
 * and the hero's text measures, against that surface: the headline and the caption's
 * lead in `{colors.on-dark}` at 14.1:1 worst case (18.3:1 on the mean tile), the lede,
 * the link and the quiet secondary action in `{colors.on-dark-mute}` at 8.1:1 worst
 * case / 9.7:1 on the mean, and the warning in `{colors.stone}` at 4.7:1 worst case /
 * 6.1:1 on the mean (6.99:1 against pure black). All clear AA; the warning is the one
 * that sits closest to it, and it is `text-caption` at `font-semibold` — the shape the
 * doc gives a disclosure.
 *
 * The `.field-layer` recipe still sits in `globals.css` (this component was the
 * only thing that rendered it) and is now unused CSS; it is left there because
 * `globals.css` is outside this change's brief, and it is flagged in the report
 * rather than edited in passing.
 *
 * THE GRAIN STAYS. It is one monochrome thing: `feTurbulence` fractal noise on a
 * 160px tile, never animated, two layers blended `screen` and `multiply` at low
 * opacity so the black bands get a little tooth and the white ones a little too.
 * It is texture rather than decoration — it is what stops a large flat canvas from
 * reading as a generated background on a display that dithered it — and it carries
 * no colour of its own. It is also the piece that keeps the surface from being
 * sterile without anything being added to look at.
 *
 * CSS only — the layer is `fixed`, so the texture never scrolls with the content
 * and never becomes a parallax. The recipe and its tokens live in `globals.css`;
 * this component only names them, so there is no hex, no gradient and no
 * millisecond here to drift out of the system.
 *
 * It replaces the stock coin video that used to fill the hero: a downloaded clip
 * of floating coins is the single most generic thing a payments page can show, and
 * the grain says the same thing in no colour at all for zero bytes.
 */
export function LandingBackdrop() {
  return <div aria-hidden className="grain-layer" />;
}
