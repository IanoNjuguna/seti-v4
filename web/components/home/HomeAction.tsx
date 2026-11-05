import Link from 'next/link';
import { Text } from '@/components/ui';
import { TEXT_COLOR, TEXT_VARIANT, VARIANT_CLASSES } from '@/components/ui/Button.constants';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import type { HomeActionProps } from './HomeActions.types';

/**
 * One of Home's actions, as the system's button.
 *
 * A `<Link>` wearing the BUTTON recipe rather than a `<button>` that navigates:
 * these are destinations, so middle-click, ⌘-click and "open in new tab" have to
 * work, and a screen reader should hear a link. The recipe is imported from
 * `Button.constants` rather than re-spelled here — a hand-copied `h-12 px-7
 * rounded-md bg-canvas-dark` would be a second copy of the system's button, which
 * is the class of defect this repo has already paid for twice (the colour-order
 * bug, the two-size wordmark).
 *
 * `flex-1` is what makes four tiles equal quarters of one row.
 *
 * THE BADGE IS A DOT, and the word moved to the accessible name (#328). A word beside
 * the label needs ~30px more than a quarter of a 390px column has, so `Save Soon` spilled
 * past its own border; stacking it under the label inside a 48px tile squeezed the glyph
 * away instead. A 6px mark in the corner costs no width, keeps the four-across row the
 * owner asked for, and says "something here is not open yet" without saying what. The
 * page behind the door says what, in its own sentence. What it costs is that the meaning
 * is no longer readable at a glance, which is why the word is still spoken (`aria-label`)
 * and still named on the door it belongs to (`HomeActions.constants.ts`).
 */
export function HomeAction({ action }: HomeActionProps) {
  return (
    <Link
      href={action.href}
      // The dot is colour, so the word it stands for is spoken rather than drawn.
      // `label, badge` keeps the visible label as the START of the name (WCAG 2.5.3).
      aria-label={action.badge ? `${action.label}, ${action.badge}` : undefined}
      className={cn(
        VARIANT_CLASSES[action.variant],
        // A tile, not a label: the glyph sits above the word, and the button height the
        // recipe already sets keeps a 48px target under both. `relative` is what the
        // corner mark is positioned against.
        'relative flex-1 flex-col gap-1 px-2'
      )}
    >
      <Icon name={action.icon} className="h-5 w-5" />
      <Text as="span" variant={TEXT_VARIANT[action.variant]} color={TEXT_COLOR[action.variant]}>
        {action.label}
      </Text>
      {/*
        The mark rides inside the same link rather than replacing it: the door still
        opens, and the page behind it explains why it is closed. A disabled link here
        would be a dead end with no sentence, and hiding it would lose the signal.

        `stone`, not a status colour: nothing is wrong with this door, it is not open
        yet. The system draws its quiet state and its fact-bearing dots with the same
        shape (`RailNetworkRow`, `SignInPaymentCard`) and reserves `accent-warning` and
        `accent-teal` for the facts.
      */}
      {action.badge ? (
        <span aria-hidden className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-stone" />
      ) : null}
    </Link>
  );
}
