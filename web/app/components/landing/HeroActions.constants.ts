/**
 * The hero's quiet second action, as one string.
 *
 * A link on the dark canvas: the footer's recipe (`text-on-dark-mute`, hover to
 * `on-dark` and underline), carrying the CTA's own label type so the row reads as
 * one line of actions, plus `min-touch` for the 44px target and `w-fit` so that
 * target holds the label instead of spanning the column.
 *
 * It is NOT the `ghost` button variant, deliberately: that variant draws its label
 * in `{colors.link}` (cobalt), and the doc is explicit that links on the dark
 * canvas step up in weight in `{colors.on-dark}` instead of taking the cobalt —
 * #376cd5 measures 4.27:1 on black, under AA at this size, while the muted white
 * measures 10.5:1. `cn()` is a plain join rather than a merge, so a colour passed
 * beside a variant's own would be decided by Tailwind's emission order instead of
 * by intent; the recipe is therefore written here, as one string, and there is no
 * second colour on the element.
 *
 * The same string dresses the one action the hero offers; there is no second label to
 * keep in step with it any more.
 */
export const QUIET_ACTION_CLASSES =
  'inline-flex min-touch w-fit items-center rounded-sm text-button font-semibold text-on-dark-mute underline-offset-4 transition-colors duration-(--duration-quick) ease-out hover:text-on-dark hover:underline active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark';
