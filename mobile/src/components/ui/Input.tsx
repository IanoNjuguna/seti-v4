import { TextInput, type TextInputProps } from 'react-native';
import { cn } from '@/lib/cn';

interface InputProps extends TextInputProps {
  hasError?: boolean;
}

export function Input({ className, hasError = false, ...props }: InputProps) {
  return (
    <TextInput
      className={cn(
        'h-12 px-4 rounded-input border bg-surface-card text-body text-text-primary',
        'placeholder:text-text-secondary',
        hasError ? 'border-alert' : 'border-border-1 focus:border-border-focus',
        className
      )}
      {...props}
    />
  );
}
