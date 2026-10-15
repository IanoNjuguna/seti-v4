import { Text } from '@/components/ui';
import { PAY_HEADING_COPY } from './PayHeading.constants';

export interface PayHeadingProps {
  /**
   * The one line under the title. It changes with the state (the instruction for
   * finding a merchant / what is being paid for), which is exactly why the title
   * does not.
   */
  subtitle: string;
}

/**
 * The pay screen's title and its one line of instruction, rendered by the page
 * and NOT inside whichever card happens to be showing.
 *
 * The title used to live in two different places depending on the state: inside
 * `MerchantEntry`'s card before a merchant was resolved, and in a bare header
 * after — so it was 20px inside a 32px-padded white card, then the same words at
 * the same size outside one, and it moved up the screen the moment the merchant
 * landed. Title first, in one place, at one level: the page owns it.
 *
 * It is the page's `h1`, not an `h2`: every route deserves exactly one top-level
 * heading, and this is it. The wording is the pay card's (`PAY_HEADING_COPY`) —
 * the card became a second title on this screen, and when it was deleted its
 * words were the ones kept.
 *
 * The subtitle is `body` + `secondary` (16px, #505a63) rather than the `micro`
 * default (14px in #8d969e, 2.9:1 on white): it is the instruction a person reads
 * to use the screen, not metadata beside it.
 */
export function PayHeading({ subtitle }: PayHeadingProps) {
  return (
    <header>
      <Text variant="section" as="h1">
        {PAY_HEADING_COPY.title}
      </Text>
      <Text variant="body" color="secondary" as="p" className="mt-1">
        {subtitle}
      </Text>
    </header>
  );
}
