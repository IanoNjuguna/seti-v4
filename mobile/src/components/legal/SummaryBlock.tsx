import { View } from 'react-native';
import { Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { LegalSummaryBlock } from '@/lib/legal/legal.summaries';

/**
 * Callout shown at the top of a summary — the one thing a user must not miss.
 * Paired with an icon-adjacent border rather than colour alone.
 */
export function SummaryCallout({ children }: { children: string }) {
  return (
    <View className="rounded-card border border-border-1 bg-surface-inset px-4 py-3">
      <Text variant="body-medium">{children}</Text>
    </View>
  );
}

/** One titled paragraph of a summary. */
export function SummaryBlock({ block }: { block: LegalSummaryBlock }) {
  return (
    <View className="mt-5">
      <Text variant="body-medium">{block.title}</Text>
      <Text variant="body" color="secondary" className="mt-1.5">
        {block.body}
      </Text>
    </View>
  );
}

/** Thin divider between blocks. */
export function BlockDivider({ isLast }: { isLast: boolean }) {
  if (isLast) return null;
  return <View className={cn('mt-5 h-px bg-border-1')} />;
}
