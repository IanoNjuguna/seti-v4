import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui';

export default function ActivityScreen() {
  return (
    <SafeAreaView className="flex-1 bg-bg-canvas items-center justify-center px-5">
      <Text variant="section" className="mb-2">Activity</Text>
      <Text variant="body" color="secondary" className="text-center">
        Your full transaction history will appear here.
      </Text>
    </SafeAreaView>
  );
}
