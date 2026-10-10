import { useCallback, useMemo } from 'react';
import {
  SectionList,
  View,
  RefreshControl,
  Text as RNText,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Button, TransactionRow } from '@/components/ui';
import { useTransactions } from '@/hooks/useTransactions';
import type { Transaction } from '@/types';

interface TransactionSection {
  title: string;
  data: Transaction[];
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function groupTransactionsByDate(transactions: Transaction[]): TransactionSection[] {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const groups: Record<string, Transaction[]> = {
    Today: [],
    Yesterday: [],
    Earlier: [],
  };

  for (const transaction of transactions) {
    if (isSameDay(transaction.date, today)) {
      groups.Today.push(transaction);
    } else if (isSameDay(transaction.date, yesterday)) {
      groups.Yesterday.push(transaction);
    } else {
      groups.Earlier.push(transaction);
    }
  }

  const sections: TransactionSection[] = [];
  if (groups.Today.length > 0) {
    sections.push({ title: 'Today', data: groups.Today });
  }
  if (groups.Yesterday.length > 0) {
    sections.push({ title: 'Yesterday', data: groups.Yesterday });
  }
  if (groups.Earlier.length > 0) {
    sections.push({ title: 'Earlier', data: groups.Earlier });
  }

  return sections;
}

export default function ActivityScreen() {
  const { transactions, loading, error, refetch } = useTransactions(50);

  const sections = useMemo(
    () => groupTransactionsByDate(transactions),
    [transactions]
  );

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (loading && transactions.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-bg-canvas items-center justify-center">
        <RNText style={{ color: '#64748B', fontSize: 14 }}>
          Loading activity…
        </RNText>
      </SafeAreaView>
    );
  }

  if (error && transactions.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-bg-canvas items-center justify-center px-6">
        <Text variant="section" className="mb-2 text-center">
          Could not load activity
        </Text>
        <Text variant="body" color="secondary" className="mb-6 text-center">
          {error}
        </Text>
        <Button variant="primary" onPress={refetch}>
          Try Again
        </Button>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-canvas">
      <SectionList<Transaction, TransactionSection>
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TransactionRow transaction={item} />}
        renderSectionHeader={({ section: { title } }) => (
          <View className="px-5 pt-4 pb-2 bg-bg-canvas">
            <Text variant="section">{title}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => null}
        SectionSeparatorComponent={() => null}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            tintColor="#059669"
          />
        }
        ListEmptyComponent={
          <View className="px-5 py-8">
            <Text variant="body" color="secondary">
              No transactions yet.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
