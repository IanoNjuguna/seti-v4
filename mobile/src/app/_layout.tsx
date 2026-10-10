import '../../global.css';

// Polyfills required by Privy / viem on React Native
import 'fast-text-encoding';
import 'react-native-get-random-values';
import '@ethersproject/shims';
import { Buffer } from 'buffer';
import { useEffect } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { PrivyProvider } from '@privy-io/expo';
import Constants from 'expo-constants';
import { tempoChain } from '@/lib/chain';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

globalThis.Buffer = globalThis.Buffer ?? Buffer;

const PRIVY_APP_ID = Constants.expoConfig?.extra?.privyAppId as string | undefined;

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthRoute =
      pathname === '/' || pathname === '/login' || pathname === '/onboarding';

    if (isAuthenticated && inAuthRoute) {
      router.replace('/(tabs)');
    } else if (!isAuthenticated && pathname.startsWith('/(tabs)')) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  return children;
}

function RootContent() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View className="flex-1 bg-bg-canvas items-center justify-center">
        <ActivityIndicator color="#059669" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <AuthGate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="legal" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="+not-found" />
          </Stack>
        </AuthGate>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </AuthProvider>
  );
}

export default function RootLayout() {
  return (
    <PrivyProvider appId={PRIVY_APP_ID ?? ''} supportedChains={[tempoChain]}>
      <RootContent />
    </PrivyProvider>
  );
}
