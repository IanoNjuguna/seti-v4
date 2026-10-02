import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Button } from '@/components/ui';

export default function ProfileScreen() {
  return (
    <SafeAreaView className="flex-1 bg-bg-canvas px-5">
      <View className="pt-4 pb-6">
        <Text variant="section">Profile</Text>
      </View>

      <View className="gap-3">
        <Button variant="secondary" fullWidth>
          Account settings
        </Button>
        <Button variant="secondary" fullWidth>
          Security
        </Button>
        <Button variant="ghost" fullWidth>
          Sign out
        </Button>
      </View>
    </SafeAreaView>
  );
}
