import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, AmountInput, Button } from '@/components/ui';
import { useState } from 'react';

export default function PayScreen() {
  const [amount, setAmount] = useState('');

  return (
    <SafeAreaView className="flex-1 bg-bg-canvas px-5">
      <View className="pt-4 pb-6">
        <Text variant="section">Send money</Text>
      </View>

      <AmountInput value={amount} onChangeText={setAmount} />

      <View className="flex-row flex-wrap gap-3 mt-4">
        {['100', '500', '1000', '2500', '5000'].map((preset) => (
          <Button
            key={preset}
            variant="pill"
            onPress={() => setAmount(preset)}
          >
            {`KES ${preset}`}
          </Button>
        ))}
      </View>

      <View className="mt-auto mb-6">
        <Button variant="primary" fullWidth>
          Continue
        </Button>
      </View>
    </SafeAreaView>
  );
}
