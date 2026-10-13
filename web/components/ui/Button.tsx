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
