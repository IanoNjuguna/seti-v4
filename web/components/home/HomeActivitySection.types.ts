import type { Transaction } from '@/lib/types';

export interface HomeActivitySectionProps {
  /** The rows to show. Empty is a real state: the empty block says so. */
  transactions: Transaction[];
}
