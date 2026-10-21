import { cn } from '@/lib/cn';
import { Text } from './Text';
import { TEXT_COLOR, TEXT_VARIANT, VARIANT_CLASSES } from './Button.constants';
import type { ButtonProps } from './Button.types';

/**
 * A loading button must show the spinner AND be disabled, or a slow request
 * looks like a dead one and gets double-submitted.
 */
export function Button({
  variant = 'primary',
  children,
  fullWidth = false,
  loading = false,
  disabled,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled ?? loading}
      aria-busy={loading}
      className={cn(
        VARIANT_CLASSES[variant],
        fullWidth && 'w-full',
        (disabled ?? loading) && 'cursor-not-allowed opacity-60',
        /*
         * `on-dark` is a white pill on the black canvas, and dimming the WHOLE control
         * blended that white to #999 and its ink to #4c4e50: 2.93:1, measured on the live
         * sign-in page, below even the 3:1 large-text floor. The disabled label was
         * therefore harder to read than the disabled state had to be.
         *
         * On this variant the dimming is replaced by a pair the system already owns, so
         * nothing is invented and no opacity is doing contrast work: the surface drops to
         * `surface-elevated`, the ink to the muted on-dark role.
         *
         * The utilities are `disabled:`-prefixed on purpose. `cn()` joins rather than
         * merges, and two conflicting classes of equal specificity are decided by the
         * generated stylesheet's order, not by the order they are written here — so a
         * plain `bg-surface-elevated` would race the variant's own `bg-canvas-light` and
         * could lose. A `:disabled`-qualified utility outranks both and applies only in
         * the state it is for.
         */
        variant === 'on-dark' && 'disabled:bg-surface-elevated disabled:text-on-dark-mute disabled:opacity-100',
        className
      )}
    >
      {loading && (
        <span
          aria-hidden
          className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      <Text as="span" variant={TEXT_VARIANT[variant]} color={TEXT_COLOR[variant]}>
        {children}
      </Text>
    </button>
  );
}
