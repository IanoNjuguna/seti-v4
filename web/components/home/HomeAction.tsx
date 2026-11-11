import Link from 'next/link';
import { Text } from '@/components/ui';
import { TEXT_COLOR, TEXT_VARIANT, VARIANT_CLASSES } from '@/components/ui/Button.constants';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import { ACTION_GRAIN } from './HomeActions.constants';
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
 * THE BADGE IS A WORD AGAIN (#377). A 6px corner dot said "something here" without saying what,
 * so the door read as decoration. The owner's call was a `New` chip: a word at 9px fits the corner
 * of a 56px tile where the old `Save Soon` did not fit beside the label. `accent-lime` because it
 * is the one chip fill in the system that is legible with `ink` on it.
 *
 * THE CHIP HAS AN EDGE, NOT A GLOW (#539). It was drawn with a 10px halo at 85% of its own fill,
 * wider than the chip it surrounded, and that is a light-emitting claim about a door whose entire
 * meaning is that it is shut. It was also compensating for the fill: `accent-lime` is 1.64:1 on
 * `canvas-light`, so the chip cannot hold its own edge on a white tile. The system already answers
 * exactly that problem once, on the commit control, with a 1px `ink` boundary and no light
 * (`Button.constants.ts`) — so the badge wears the same one. One fill, one boundary, no second
 * colour, and the raised control in the row stays the only thing throwing a shadow.
 *
 * The word stays in the link's accessible name as well, so "Save, New" is what a screen reader
 * hears, and the page behind the door still says in a sentence why it is not open yet.
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
        /*
         * A tile, not a label: the glyph sits above the word and both stay inside the fill.
         *
         * 56, not the recipe's 48 (#377): a 20px glyph, a 4px gap and a 14px word came to 38px
         * of content in 48px, so the word sat on the fill's edge. `h-14` overrides `h-12` on the
         * same property, and Tailwind emits the scale in order, so the larger step wins.
         *
         * `relative` is what the grain plate and the corner tag are positioned against. No
         * `overflow-hidden` here: the tag hangs above the tile's top edge, so the clipping has to
         * happen on the plate itself.
         */
        'relative flex-1 flex-col gap-1 px-2 h-14'
      )}
    >
      {action.variant === 'primary' ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-md opacity-[0.16]"
          style={{ backgroundImage: ACTION_GRAIN }}
        />
      ) : null}
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
        <span
          aria-hidden
          /*
           * Above the tile, not on it (#377). At 71px wide a 56px tile has no corner to spare: the
           * chip sat on the glyph's shoulder and cut it in half. Hung off the top edge it reads as
           * a tag stuck to the door, and the tile's own icon and word stay whole.
           */
          className="absolute -top-2 right-1.5 rounded-full border border-ink bg-accent-lime px-1.5 py-px text-[9px] font-semibold uppercase leading-[1.35] tracking-wide text-ink"
        >
          {action.badge}
        </span>
      ) : null}
    </Link>
  );
}
