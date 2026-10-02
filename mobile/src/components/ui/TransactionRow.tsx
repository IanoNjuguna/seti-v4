import { Pressable, View } from 'react-native';
import { Text } from './Text';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/formatCurrency';
import type { Transaction } from '@/types';

interface TransactionRowProps {
  transaction: Transaction;
  onPress?: (transaction: Transaction) => void;
}

export function TransactionRow({ transaction, onPress }: TransactionRowProps) {
  const { merchant, category, amount, date, status } = transaction;
  const isNegative = amount < 0;
  const formatted = formatCurrency(Math.abs(amount));

  return (
    <Pressable
      onPress={() => onPress?.(transaction)}
      className="flex-row items-center h-16 px-5 border-b border-border-1 active:bg-surface-inset"
      accessibilityRole="button"
    >
      <View className="w-10 h-10 rounded-full bg-surface-inset items-center justify-center mr-3">
        <Text variant="card-title">{merchant.charAt(0)}</Text>
      </View>

      <View className="flex-1">
        <Text variant="card-title">{merchant}</Text>
        <Text variant="micro">
          {category} · {date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
        </Text>
      </View>

      <View className="items-end">
        <Text
          variant="body-medium"
          tabular
          className={cn(isNegative ? 'text-text-primary' : 'text-alert')}
        >
          {isNegative ? '-' : ''}{formatted}
        </Text>
        {status !== 'completed' && (
          <Text variant="micro" color={status === 'pending' ? 'secondary' : 'alert'}>
            {status}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
