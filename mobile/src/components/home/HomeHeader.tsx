import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Text, Button, Badge, Sheet } from '@/components/ui';
import { formatCurrency } from '@/lib/formatCurrency';
import type { HomeDashboard } from '@/lib/api';

interface ComingSoonSheet {
  title: string;
  message: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

interface HomeHeaderProps {
  data: HomeDashboard | null;
}

export function HomeHeader({ data }: HomeHeaderProps) {
  const [sheet, setSheet] = useState<ComingSoonSheet | null>(null);

  const balance = data ? Number(data.balance) : 0;
  const delta = data?.monthToDateDelta ?? 0;
  const hasDelta = data && delta !== 0;

  const openComingSoon = (title: string, message: string) => {
    setSheet({ title, message });
  };

  return (
    <View className="px-5 pt-4 pb-6">
      <Text variant="micro" color="secondary" className="mb-1">
        {getGreeting()}
      </Text>
      <Text variant="balance" tabular className="mb-3">
        {formatCurrency(balance)}
      </Text>

      {hasDelta && (
        <Badge variant={delta > 0 ? 'success' : 'neutral'}>
          {`${delta > 0 ? '↑' : '↓'} ${(Math.abs(delta) * 100).toFixed(1)}% this month`}
        </Badge>
      )}

      <View className="flex-row gap-3 mt-6">
        <Button
          variant="primary"
          className="flex-1"
          onPress={() => openComingSoon('Add Money', 'Top up via bank card or M-Pesa coming soon')}
        >
          Add Money
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onPress={() => openComingSoon('Send to friends', 'Send to friends coming soon')}
        >
          Send
        </Button>
        <Button variant="secondary" className="flex-1" onPress={() => router.push('/(tabs)/pay')}>
          Pay
        </Button>
      </View>

      <Text variant="section" className="mt-8 mb-2">
        Recent Activity
      </Text>

      <Sheet visible={!!sheet} onClose={() => setSheet(null)}>
        <Text variant="section" className="mb-2">
          {sheet?.title}
        </Text>
        <Text variant="body" color="secondary">
          {sheet?.message}
        </Text>
      </Sheet>
    </View>
  );
}
