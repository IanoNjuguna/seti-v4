import { Link, Stack } from 'expo-router';
import { View } from 'react-native';
import { Text, Button } from '@/components/ui';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View className="flex-1 bg-bg-canvas items-center justify-center px-5">
        <Text variant="section" className="mb-2">Page not found</Text>
        <Text variant="body" color="secondary" className="mb-6 text-center">
          The screen you’re looking for doesn’t exist.
        </Text>
        <Link href="/" asChild>
          <Button variant="primary">Go home</Button>
        </Link>
      </View>
    </>
  );
}
