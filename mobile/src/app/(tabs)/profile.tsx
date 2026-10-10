import { View, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { COOKIES_URL } from '@/lib/legal/legal.constants';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-canvas px-5">
      <View className="pt-4 pb-6">
        <Text variant="section">Profile</Text>
      </View>

      <View className="gap-4 mb-8">
        <View className="bg-surface-card border border-border-1 rounded-input px-4 py-3">
          <Text variant="micro" color="secondary">
            Email
          </Text>
          <Text variant="body-medium">{user?.email ?? '—'}</Text>
        </View>

        <View className="bg-surface-card border border-border-1 rounded-input px-4 py-3">
          <Text variant="micro" color="secondary">
            Phone number
          </Text>
          <Text variant="body-medium" color="secondary">
            {user?.phone ?? 'Not verified'}
          </Text>
        </View>

        <View className="bg-surface-card border border-border-1 rounded-input px-4 py-3">
          <Text variant="micro" color="secondary">
            KYC tier
          </Text>
          <Text variant="body-medium" color="secondary">
            Coming soon
          </Text>
        </View>
      </View>

      <View className="gap-3">
        <Button variant="secondary" fullWidth disabled>
          Account settings
        </Button>
        <Button variant="secondary" fullWidth disabled>
          Security
        </Button>

        <View className="bg-surface-card border border-border-1 rounded-input overflow-hidden">
          <Pressable
            onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })}
            accessibilityRole="button"
            accessibilityLabel="Read the Terms of Use"
            className="min-touch flex-row items-center justify-between px-4 py-3 active:bg-surface-inset"
          >
            <Text variant="body">Terms of Use</Text>
            <Ionicons name="chevron-forward" size={18} color="#8d969e" />
          </Pressable>
          <View className="h-px bg-border-1" />
          <Pressable
            onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })}
            accessibilityRole="button"
            accessibilityLabel="Read the Privacy Policy"
            className="min-touch flex-row items-center justify-between px-4 py-3 active:bg-surface-inset"
          >
            <Text variant="body">Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={18} color="#8d969e" />
          </Pressable>
          <View className="h-px bg-border-1" />
          <Pressable
            onPress={() => Linking.openURL(COOKIES_URL)}
            accessibilityRole="button"
            accessibilityLabel="Read the Cookie Notice on the website"
            className="min-touch flex-row items-center justify-between px-4 py-3 active:bg-surface-inset"
          >
            <Text variant="body">Cookie Notice</Text>
            <Ionicons name="open-outline" size={18} color="#8d969e" />
          </Pressable>
        </View>

        <Button variant="ghost" fullWidth onPress={handleSignOut}>
          Sign out
        </Button>
      </View>
    </SafeAreaView>
  );
}
