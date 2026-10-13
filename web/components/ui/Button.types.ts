import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { ButtonVariant } from '@/lib/types';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
  fullWidth?: boolean;
  /** Shows the spinner and disables the button (DESIGN.md §5). */
  loading?: boolean;
}
