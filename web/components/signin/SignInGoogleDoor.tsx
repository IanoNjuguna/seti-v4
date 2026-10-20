'use client';

import { Button, Text } from '@/components/ui';
import { SIGN_IN_COPY } from './SignInScreen.constants';

/**
 * The Google door, and the line that introduces the other one.
 *
 * `outline-dark` rather than the white CTA: the product's own path is the email code,
 * and two loud buttons on one screen is a page asking the customer to guess which one
 * the product wants. This is the shortcut, drawn as a shortcut.
 *
 * It carries no G mark. `design-kit/` has no Google asset and inventing one is how a
 * brand file ends up with a fourth variant of a mark; text-only until the real one is
 * added to the kit.
 *
 * The line under it says `or use your email` rather than a centred rule with `or` in
 * the middle: centred ornament between two flush-left controls is a second composition
 * on a page that only has one.
 */
export function SignInGoogleDoor({ disabled, onGoogle }: { disabled: boolean; onGoogle: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline-dark" fullWidth onClick={onGoogle} disabled={disabled}>
        {SIGN_IN_COPY.google}
      </Button>
      <Text as="p" variant="micro" color="inverse-muted">
        {SIGN_IN_COPY.orEmail}
      </Text>
    </div>
  );
}
