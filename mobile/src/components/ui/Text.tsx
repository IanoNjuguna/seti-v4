import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { cn } from '@/lib/cn';

export type TextVariant =
  | 'balance'
  | 'section'
  | 'card-title'
  | 'body'
  | 'body-medium'
  | 'micro'
  | 'button'
  | 'tab';

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tabular?: boolean;
  color?: 'primary' | 'secondary' | 'inverse' | 'accent' | 'alert';
}

const variantClasses: Record<TextVariant, string> = {
  balance: 'text-balance text-text-primary',
  section: 'text-section text-text-primary',
  'card-title': 'text-card-title text-text-primary',
  body: 'text-body text-text-primary',
  'body-medium': 'text-body-medium text-text-primary',
  micro: 'text-micro text-text-secondary',
  button: 'text-button text-inverse',
  tab: 'text-tab',
};

const colorClasses = {
  primary: 'text-text-primary',
  secondary: 'text-text-secondary',
  inverse: 'text-text-inverse',
  accent: 'text-accent-primary',
  alert: 'text-alert',
};

export function Text({
  variant = 'body',
  tabular = false,
  color,
  className,
  ...props
}: TextProps) {
  return (
    <RNText
      className={cn(
        variantClasses[variant],
        color && colorClasses[color],
        tabular && 'font-tabular',
        className
      )}
      {...props}
    />
  );
}
