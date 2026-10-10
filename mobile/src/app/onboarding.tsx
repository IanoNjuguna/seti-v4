import { useState } from 'react';
import { View, Pressable, Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input } from '@/components/ui';
import { useLegalConsent } from '@/hooks/useLegalConsent';

export default function OnboardingScreen() {
  const router = useRouter();
  const { accept, hasConsent } = useLegalConsent();
  const [displayName, setDisplayName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(hasConsent);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleContinue() {
    setIsSubmitting(true);
    // In v1, Privy creates the embedded wallet on login. This screen simply
    // confirms the user's profile and terms acceptance before entering the app.
    // Acceptance is persisted so a re-install prompt is auditable later; the
    // continue button stays disabled until the record is safely written.
    const recorded = await accept();
    if (!recorded) {
      setIsSubmitting(false);
      return;
    }
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-canvas">
      <View className="flex-1 px-6 pt-12 pb-8 justify-between">
        <View>
          <Text variant="section" className="mb-2">
            Finish setting up
          </Text>
          <Text variant="body" color="secondary" className="mb-8">
            What should we call you?
          </Text>

          <View className="space-y-4 mb-6">
            <Input
              placeholder="Display name"
              autoCapitalize="words"
              value={displayName}
              onChangeText={setDisplayName}
              editable={!isSubmitting}
            />
          </View>

          <Pressable
            onPress={() => setAcceptedTerms((prev) => !prev)}
            disabled={isSubmitting}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms, disabled: isSubmitting }}
            accessibilityLabel="Accept the Terms of Use and Privacy Policy"
            className="flex-row items-start py-3"
          >
            <View
              className={`w-6 h-6 rounded-md border items-center justify-center mt-0.5 ${
                acceptedTerms
                  ? 'bg-accent-primary border-accent-primary'
                  : 'border-border-1 bg-surface-card'
              }`}
            >
              {acceptedTerms && (
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              )}
            </View>
            <View className="flex-1 ml-3">
              <RNText className="text-body text-text-secondary">
                I accept the{' '}
                <RNText
                  className="text-accent-primary"
                  onPress={() =>
                    router.push({ pathname: '/legal', params: { doc: 'terms' } })
                  }
                >
                  Terms of Use
                </RNText>{' '}
                and{' '}
                <RNText
                  className="text-accent-primary"
                  onPress={() =>
                    router.push({ pathname: '/legal', params: { doc: 'privacy' } })
                  }
                >
                  Privacy Policy
                </RNText>
              </RNText>
            </View>
          </Pressable>
        </View>

        <Button
          fullWidth
          onPress={handleContinue}
          disabled={!displayName || !acceptedTerms || isSubmitting}
        >
          {isSubmitting ? 'Creating wallet…' : 'Create wallet'}
        </Button>
      </View>
    </SafeAreaView>
  );
}
