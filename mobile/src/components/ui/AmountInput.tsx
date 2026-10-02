import { TextInput, View, type TextInputProps } from 'react-native';
import { Text } from './Text';
import { cn } from '@/lib/cn';

interface AmountInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (value: string) => void;
  currency?: string;
  error?: string;
}

export function AmountInput({
  value,
  onChangeText,
  currency = 'KES',
  error,
  className,
  ...props
}: AmountInputProps) {
  return (
    <View className={cn('items-center py-6', className)}>
      <Text variant="section" color="secondary" className="mb-2">
        {currency}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder="0.00"
        className="text-balance font-tabular text-text-primary text-center min-w-[200px]"
        accessibilityLabel="Amount input"
        {...props}
      />
      {error ? (
        <Text variant="micro" color="alert" className="mt-2">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
