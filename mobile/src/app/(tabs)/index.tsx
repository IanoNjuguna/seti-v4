import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Button, Card, Badge, TransactionRow } from '@/components/ui';
import { formatCurrency } from '@/lib/formatCurrency';
import type { Transaction } from '@/types';

const BALANCE = 12450.0;

const RECENT: Transaction[] = [
  {
    id: '1',
    merchant: 'Java House',
    category: 'Dining',
    amount: -250.0,
    date: new Date(),
    status: 'completed',
  },
  {
    id: '2',
    merchant: 'Safaricom',
    category: 'Airtime',
    amount: -100.0,
    date: new Date(Date.now() - 86400000),
    status: 'completed',
  },
  {
    id: '3',
    merchant: 'Alice M.',
    category: 'Transfer',
    amount: -1250.0,
    date: new Date(Date.now() - 172800000),
    status: 'completed',
  },
];

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-bg-canvas">
      <FlatList
        data={RECENT}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View className="px-5 pt-4 pb-6">
            <Text variant="micro" color="secondary" className="mb-1">
              Good morning
            </Text>
            <Text variant="balance" tabular className="mb-3">
              {formatCurrency(BALANCE)}
            </Text>
            <Badge variant="success">↑ 2.4% this month</Badge>

            <View className="flex-row gap-3 mt-6">
              <Button variant="primary" className="flex-1">
                Add Money
              </Button>
              <Button variant="secondary" className="flex-1">
                Send
              </Button>
              <Button variant="secondary" className="flex-1">
                Pay
              </Button>
            </View>

            <Text variant="section" className="mt-8 mb-2">
              Recent Activity
            </Text>
          </View>
        }
        renderItem={({ item }) => <TransactionRow transaction={item} />}
        ItemSeparatorComponent={() => null}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}
