import { FlatList, View, Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Button, TransactionRow } from '@/components/ui';
import { HomeHeader } from '@/components/home/HomeHeader';
import { useHomeData, mapRecentToUiTransaction } from '@/hooks/useHomeData';

export default function HomeScreen() {
  const { data, loading, error, refetch } = useHomeData();

  if (loading && !data) {
    return (
      <SafeAreaView className="flex-1 bg-bg-canvas items-center justify-center">
        <RNText style={{ color: '#64748B', fontSize: 14 }}>
          Loading your account…
        </RNText>
      </SafeAreaView>
    );
  }

  if (error && !data) {
    return (
      <SafeAreaView className="flex-1 bg-bg-canvas items-center justify-center px-6">
        <RNText style={{ color: '#0F172A', fontSize: 20, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>
          Could not load account
        </RNText>
        <RNText style={{ color: '#64748B', fontSize: 14, marginBottom: 24, textAlign: 'center' }}>
          {error}
        </RNText>
        <Button variant="primary" onPress={refetch}>
          Try Again
        </Button>
      </SafeAreaView>
    );
  }

  const transactions = data?.recentTransactions.map(mapRecentToUiTransaction) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-bg-canvas">
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<HomeHeader data={data} />}
        renderItem={({ item }) => <TransactionRow transaction={item} />}
        ItemSeparatorComponent={() => null}
        contentContainerStyle={{ paddingBottom: 24 }}
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
