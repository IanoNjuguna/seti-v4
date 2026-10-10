import { useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button } from '@/components/ui';
import {
  SummaryCallout,
  SummaryBlock,
  BlockDivider,
} from '@/components/legal/SummaryBlock';
import {
  LEGAL,
  TERMS_URL,
  PRIVACY_URL,
} from '@/lib/legal/legal.constants';
import {
  termsSummary,
  privacySummary,
  type LegalSummary,
} from '@/lib/legal/legal.summaries';

type LegalDoc = 'terms' | 'privacy';

function summaryFor(doc: LegalDoc): LegalSummary {
  return doc === 'terms' ? termsSummary : privacySummary;
}

function fullUrl(doc: LegalDoc): string {
  return doc === 'terms' ? TERMS_URL : PRIVACY_URL;
}

export default function LegalDocumentScreen() {
  const router = useRouter();
  const { doc: rawDoc } = useLocalSearchParams<{ doc?: string }>();
  const doc: LegalDoc = rawDoc === 'privacy' ? 'privacy' : 'terms';
  const [openFailed, setOpenFailed] = useState(false);

  const summary = summaryFor(doc);
  const otherDoc: LegalDoc = doc === 'terms' ? 'privacy' : 'terms';
  const otherLabel = otherDoc === 'privacy' ? 'Privacy Policy' : 'Terms of Use';

  const handleOpenFull = async () => {
    const supported = await Linking.canOpenURL(fullUrl(doc));
    if (!supported) {
      setOpenFailed(true);
      return;
    }
    await Linking.openURL(fullUrl(doc));
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-canvas">
      <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="min-touch justify-center"
        >
          <Ionicons name="chevron-back" size={24} color="#059669" />
        </Pressable>
        <Text variant="section">{summary.title}</Text>
        <View className="w-6" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-12"
        showsVerticalScrollIndicator={false}
      >
        <Text variant="micro" color="secondary" className="mt-2">
          Effective {LEGAL.effectiveDate}
        </Text>
        <Text variant="body" color="secondary" className="mt-4">
          {summary.description}
        </Text>

        {summary.callout ? (
          <View className="mt-6">
            <SummaryCallout>{summary.callout}</SummaryCallout>
          </View>
        ) : null}

        {summary.blocks.map((block, index) => (
          <View key={block.title}>
            <SummaryBlock block={block} />
            <BlockDivider isLast={index === summary.blocks.length - 1} />
          </View>
        ))}

        <View className="mt-8 rounded-card border border-border-1 bg-surface-card p-4">
          <Text variant="card-title">Read the full document</Text>
          <Text variant="body" color="secondary" className="mt-2">
            This is a summary. The binding Terms and Privacy Policy are published
            in full on our website.
          </Text>
          {openFailed ? (
            <Text variant="micro" color="alert" className="mt-3">
              Could not open {fullUrl(doc)}. Copy the address into your browser.
            </Text>
          ) : null}
          <View className="mt-4">
            <Button variant="secondary" fullWidth onPress={handleOpenFull}>
              Open full document
            </Button>
          </View>
        </View>

        <Pressable
          onPress={() =>
            router.replace({ pathname: '/legal', params: { doc: otherDoc } })
          }
          accessibilityRole="button"
          className="mt-6 min-touch justify-center py-2"
        >
          <Text variant="body" color="accent">
            Read the {otherLabel}
          </Text>
        </Pressable>

        <Text variant="micro" color="secondary" className="mt-8">
          {LEGAL.company} · {LEGAL.contactEmail}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
