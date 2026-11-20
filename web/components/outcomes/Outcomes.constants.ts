import type { IconName } from '@/components/ui/icon-paths.constants';

/**
 * What the Outcomes screen says, and the mark the dock and the page are drawn with.
 *
 * OUTCOMES IS NOT OPEN, and the copy says so rather than dressing an empty state as data
 * that has not arrived. The distinction matters here: `StateMessage`'s `empty` shape reads
 * *nothing here yet + what will appear*, and it is right only because the second half of that
 * sentence is the truth — there is no figure, no chart and no summary waiting behind this
 * page yet, so a promise of "your numbers will appear here" would be a claim about a product
 * that does not exist.
 *
 * The title is the dock's own label: one word, the same one, so the tab and the page cannot
 * drift apart the way a dock called `Outcomes` and a heading called something else always do.
 */
export const OUTCOMES_COPY = {
  title: 'Outcomes',
  /** The state's title. A heading, so it holds the verb-less fact and nothing else. */
  stateTitle: "Outcomes isn't open yet",
  /** One sentence, second person, no figure and no date promised. */
  stateBody: 'It is still being built. There is nothing to show yet.',
} as const;

/** The dock's mark for this place, kept beside the copy so the two are argued once. */
export const OUTCOMES_ICON: IconName = 'crystalBall';
