import { Pressable, type PressableProps } from 'react-native';
import { Text } from './Text';
import { cn } from '@/lib/cn';
import type { ButtonVariant } from '@/types';

interface ButtonProps extends PressableProps {
  variant?: ButtonVariant;
  children: string;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-primary active:bg-accent-hover active:scale-[0.98] rounded-input min-touch h-12 px-5 items-center justify-center',
  secondary:
    'bg-surface-card border border-border-1 active:bg-surface-inset active:scale-[0.98] rounded-input min-touch h-12 px-5 items-center justify-center',
  ghost:
    'bg-transparent active:bg-surface-inset active:scale-[0.98] rounded-input min-touch h-12 px-5 items-center justify-center',
  destructive:
    'bg-alert active:scale-[0.98] rounded-input min-touch h-12 px-5 items-center justify-center',
  pill:
    'bg-surface-inset active:bg-border-1 rounded-pill h-8 px-3 items-center justify-center',
};

const textVariant: Record<ButtonVariant, 'button' | 'micro'> = {
  primary: 'button',
  secondary: 'button',
  ghost: 'button',
  destructive: 'button',
  pill: 'micro',
};

const textColor: Record<ButtonVariant, 'inverse' | 'primary' | 'secondary' | 'accent'> = {
  primary: 'inverse',
  secondary: 'primary',
  ghost: 'accent',
  destructive: 'inverse',
  pill: 'secondary',
};

export function Button({
  variant = 'primary',
  children,
  fullWidth = false,
  className,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      className={cn(variantClasses[variant], fullWidth && 'w-full', className)}
      accessibilityRole="button"
      {...props}
    >
      <Text variant={textVariant[variant]} color={textColor[variant]}>
        {children}
      </Text>
    </Pressable>
  );
}
