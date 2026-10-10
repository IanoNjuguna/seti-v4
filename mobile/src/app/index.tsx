import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text, Button } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { devLogin } from '@/lib/api';

export default function WelcomeScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [isDevLoading, setIsDevLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDevLogin() {
    setIsDevLoading(true);
    setError(null);
    try {
      const { user, token } = await devLogin();
      await signIn(token, user);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dev login failed');
    } finally {
      setIsDevLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-canvas">
      <View className="flex-1 px-6 pt-12 pb-8 justify-between">
        <View className="items-center">
          <View className="w-16 h-16 rounded-2xl bg-accent-primary items-center justify-center mb-6">
            <Text className="text-3xl font-semibold text-text-inverse">S</Text>
          </View>
          <Text variant="balance" className="text-center mb-3">
            Seti
          </Text>
          <Text variant="body" color="secondary" className="text-center">
            Stable payments for everyday life
          </Text>
        </View>

        <View className="space-y-4">
          <Text variant="section" className="text-center mb-2">
            Scan any QR. Pay in stablecoins. Merchants get KES.
          </Text>
          <Button fullWidth onPress={() => router.push('/login')}>
            Get started
          </Button>

          {__DEV__ && (
            <Button
              variant="ghost"
              fullWidth
              onPress={handleDevLogin}
              disabled={isDevLoading}
            >
              {isDevLoading ? 'Signing in…' : 'Dev login (no Privy)'}
            </Button>
          )}

          {error && (
            <Text variant="body" color="alert" className="text-center">
              {error}
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
