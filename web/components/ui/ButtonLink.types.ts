import type { AnchorHTMLAttributes, ReactNode } from 'react';
import type { ButtonVariant } from '@/lib/types';

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Where the action goes. Internal routes only, so `next/link` prefetches them. */
  href: string;
  variant?: ButtonVariant;
  children: ReactNode;
  fullWidth?: boolean;
}
