import { cn } from '@/lib/cn';
import { Text } from './Text';
import { TEXT_COLOR, TEXT_VARIANT, VARIANT_CLASSES } from './Button.constants';
import type { TextColor } from './Text.types';
import type { ButtonProps } from './Button.types';

/**
 * A loading button must show the spinner AND be disabled, or a slow request
 * looks like a dead one and gets double-submitted.
 *
 * ## A disabled label keeps its own colour, because the fill moved under it
 *
 * `on-dark` is a white pill with an ink label. When it is disabled the fill steps down to
 * `surface-elevated` — and the label, which is a `Text` child with its own colour class,
 * stayed ink: black type on a near-black fill, which is the button disappearing rather
 * than the button saying "not yet". The variant's `disabled:` background was doing the
 * right thing while the label kept a colour chosen for the surface it no longer had.
 *
 * So the label's role is part of the disabled decision, not just the fill's: on the
 * `on-dark` pill an inert label switches to the muted on-dark ink, which is the pair the
 * system already owns for exactly this (`Mark`, the disabled Button doc above).
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
  const inert = disabled ?? loading;
  const color: TextColor = inert && variant === 'on-dark' ? 'inverse-muted' : TEXT_COLOR[variant];

  return (
    <button
      {...props}
      type={type}
      disabled={inert}
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
      <Text as="span" variant={TEXT_VARIANT[variant]} color={color}>
        {children}
      </Text>
    </button>
  );
}
