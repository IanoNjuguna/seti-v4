import Link from 'next/link';
import { cn } from '@/lib/cn';
import { Text } from './Text';
import { TEXT_COLOR, TEXT_VARIANT, VARIANT_CLASSES } from './Button.constants';
import type { ButtonLinkProps } from './ButtonLink.types';

/**
 * A navigation action, wearing a `Button` recipe.
 *
 * The same action used to be built as `<Link><Button>…</Button></Link>`, which is
 * TWO controls for one job: the anchor and the button are both focusable, so a
 * keyboard user tabs through the action twice, and interactive content nested in
 * an anchor is invalid HTML besides. The DOM proved it — the home screen rendered
 * both `A [Find a merchant] /app/pay` and `BUTTON [Find a merchant]`.
 *
 * So the anchor IS the control. It carries the variant's classes and its label
 * through the same `Button.constants` maps `Button` uses, which keeps one source
 * for the recipe: change a variant there and both the button and the link change.
 * `Text as="span"` is the label because a `<span>` is not interactive — nothing
 * nested here is a second control.
 */
export function ButtonLink({
  variant = 'primary',
  href,
  children,
  fullWidth = false,
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      {...props}
      className={cn(VARIANT_CLASSES[variant], fullWidth && 'w-full', className)}
    >
      <Text as="span" variant={TEXT_VARIANT[variant]} color={TEXT_COLOR[variant]}>
        {children}
      </Text>
    </Link>
  );
}
