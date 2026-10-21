import Link from 'next/link';
import { Text } from '@/components/ui';
import { TEXT_COLOR, TEXT_VARIANT, VARIANT_CLASSES } from '@/components/ui/Button.constants';
import { cn } from '@/lib/cn';
import type { HomeActionProps } from './HomeActions.types';

/**
 * One of Home's two actions, as the system's button.
 *
 * A `<Link>` wearing the BUTTON recipe rather than a `<button>` that navigates:
 * these are destinations, so middle-click, ⌘-click and "open in new tab" have to
 * work, and a screen reader should hear a link. The recipe is imported from
 * `Button.constants` rather than re-spelled here — a hand-copied `h-12 px-7
 * rounded-md bg-canvas-dark` would be a second copy of the system's button, which
 * is the class of defect this repo has already paid for twice (the colour-order
 * bug, the two-size wordmark).
 *
 * `flex-1` is what makes the pair equal halves of one row.
 */
export function HomeAction({ action }: HomeActionProps) {
  return (
    <Link href={action.href} className={cn(VARIANT_CLASSES[action.variant], 'flex-1')}>
      <Text as="span" variant={TEXT_VARIANT[action.variant]} color={TEXT_COLOR[action.variant]}>
        {action.label}
      </Text>
    </Link>
  );
}
