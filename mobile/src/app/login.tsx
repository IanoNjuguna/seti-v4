import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLoginWithEmail, usePrivy, type PrivyUser } from '@privy-io/expo';
import { Text, Button, Input } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { post } from '@/lib/api/client';
import type { AuthUser } from '@/contexts/auth.types';

interface VerifyResponse {
  user: AuthUser;
}

function toAuthUser(privyUser: PrivyUser, backendUser: AuthUser): AuthUser {
  return {
    id: backendUser.id,
    email: backendUser.email,
    firstName: backendUser.firstName,
    lastName: backendUser.lastName,
    phone: backendUser.phone,
  };
}

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { getAccessToken } = usePrivy();
  const { sendCode, loginWithCode, state } = useLoginWithEmail();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLoading =
    state.status === 'sending-code' ||
    state.status === 'submitting-code' ||
    isSubmitting;

  async function handleSendCode() {
    setError(null);
    try {
      await sendCode({ email });
      setCodeSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code. Please try again.');
    }
  }

  async function handleVerify() {
    setError(null);
    setIsSubmitting(true);

    try {
      const privyUser = await loginWithCode({ email, code });
      if (!privyUser) {
        throw new Error('Login failed. Please try again.');
      }

      const token = await getAccessToken();
      if (!token) {
        throw new Error('Could not retrieve session token. Please try again.');
      }

      const { user: backendUser } = await post<VerifyResponse>('/auth/verify', { token });
      const authUser = toAuthUser(privyUser, backendUser);
      await signIn(token, authUser);

      if (authUser.firstName) {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-canvas">
      <View className="flex-1 px-6 pt-12 pb-8 justify-between">
        <View>
          <Text variant="section" className="mb-2">
            Sign in with email
          </Text>
          <Text variant="body" color="secondary" className="mb-8">
            We&apos;ll send a one-time code to your inbox.
          </Text>

          <View className="space-y-4 mb-6">
            <Input
              placeholder="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              editable={!isLoading}
            />

            {codeSent && (
              <Input
                placeholder="Enter 6-digit code"
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
                editable={!isLoading}
              />
            )}
          </View>

          {error && (
            <Text variant="body" color="alert" className="mb-4">
              {error}
            </Text>
          )}

          {!codeSent ? (
            <Button
              fullWidth
              onPress={handleSendCode}
              disabled={!email || isLoading}
            >
              {state.status === 'sending-code' ? 'Sending…' : 'Send code'}
            </Button>
          ) : (
            <Button
              fullWidth
              onPress={handleVerify}
              disabled={!code || isLoading}
            >
              {isLoading ? 'Verifying…' : 'Verify'}
            </Button>
          )}
        </View>

        <Button variant="ghost" onPress={() => router.back()} disabled={isLoading}>
          Back
        </Button>
      </View>
    </SafeAreaView>
  );
}
