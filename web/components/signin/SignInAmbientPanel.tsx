import { Text } from '@/components/ui';
import { SIGN_IN_AMBIENT_COPY } from './SignInAmbientPanel.constants';
import { SignInPaymentCard } from './SignInPaymentCard';

/**
 * The right half of the front door: the landing page's field, scoped to this panel, with
 * one payment card floating in it.
 *
 * ## Why the panel exists at all
 *
 * The page was one 384px column on black, which is correct and reads as a form on a
 * rectangle. The panel gives it a second surface and real depth without adding a single
 * field: the sign-in column is untouched, and the product shows itself on the side the
 * person is not working in.
 *
 * It is `hidden` below `lg` and that is not a compromise: on a phone the column IS the
 * page, and a decorative half-screen above it would push the instruction below the fold
 * on the one surface where that hurts most.
 *
 * `aria-hidden` because it is a picture. A screen reader reading a fake receipt before
 * the form would be the panel costing the page its clarity.
 *
 * The card sits 24px below the panel's optical centre (`translate-y-6`): centred
 * geometrically it reads high against the form column's mass, and the nudge is the
 * difference between "floating in the field" and "pasted at the top".
 */
export function SignInAmbientPanel() {
  return (
    <div
      aria-hidden
      className="relative hidden overflow-hidden border-l border-hairline-dark bg-surface-deep lg:block"
    >
      <div className="field-layer field-layer-panel" />

      <div className="relative flex h-full items-center justify-center p-10">
        <div className="w-full max-w-sm translate-y-6">
          <SignInPaymentCard />
        </div>
      </div>

      <Text
        as="span"
        variant="micro"
        color="inverse-muted"
        className="pointer-events-none absolute bottom-8 left-10 uppercase tracking-[0.16em] opacity-40"
      >
        {SIGN_IN_AMBIENT_COPY.stamp}
      </Text>
    </div>
  );
}
