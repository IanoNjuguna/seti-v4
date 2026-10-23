import { Text } from '@/components/ui';
import { PAY_COPY } from './PayPublic.constants';
import type { PayPageFrameProps } from './PayPublic.types';

/**
 * The page around a request: our mark, and the white canvas it sits on.
 *
 * It is a component rather than markup inside the route so the check suite can render
 * THE PAGE both tiers, frame included. The mark is one of the facts #154 says must not
 * disappear when a merchant is unverified: our name on a stranger's request is the reason
 * the facilitated-by line and the charge id exist beside it, and a tier that dropped it
 * would be hiding Seti's own hand instead of describing it.
 *
 * The wordmark belongs to the PAGE, not to the charge: a refusal has to say who is
 * refusing, or a stranger cannot tell it from a broken link.
 */
export function PayPageFrame({ children }: PayPageFrameProps) {
  return (
    <main className="min-h-dvh bg-canvas-light text-ink">
      <div className="mx-auto w-full max-w-md px-5 py-10">
        <div className="space-y-6">
          <Text variant="micro" as="p" color="primary" className="font-brand text-heading-sm">
            {PAY_COPY.brand}
          </Text>

          {children}
        </div>
      </div>
    </main>
  );
}
