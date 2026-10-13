import type { ReactNode } from 'react';
import type { BadgeVariant } from '@/lib/types';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}
