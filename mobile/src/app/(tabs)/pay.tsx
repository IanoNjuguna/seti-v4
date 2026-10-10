import { useEffect, useState } from 'react';
import { View, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, AmountInput, Button, Card } from '@/components/ui';
import { QrScanner } from '@/components/QrScanner';
import { usePayMerchant } from '@/hooks/usePayMerchant';
import { useAuth } from '@/contexts/AuthContext';
import { get } from '@/lib/api/client';

type PayMode = 'scan' | 'manual' | 'form';

interface BalanceResponse {
  asset: string;
  balance: string;
  currency: string;
}

export default function PayScreen() {
  const { user } = useAuth();
  const {
    merchant,
    amount,
    preview,
    step,
    error,
    errorKind,
    txHash,
    setAmount,
    resolve,
    pay,
    reset,
  } = usePayMerchant();

  const [mode, setMode] = useState<PayMode>('scan');
  const [qrPayload, setQrPayload] = useState('');
  const [balance, setBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  // `insufficient-gas` is a terminal failure like `error`, not work in progress.
  // Omitting it here would leave the pay button disabled after the customer is
  // told to add funds, with no way to retry.
  const isBusy =
    step !== 'idle' && step !== 'error' && step !== 'insufficient-gas' && step !== 'done';

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!user?.id) {
      setBalanceLoading(false);
      return;
    }

    let cancelled = false;
    setBalanceLoading(true);

    get<BalanceResponse>(`/users/${user.id}/balance`)
      .then((result) => {
        if (!cancelled) setBalance(result.balance);
      })
      .catch(() => {
        if (!cancelled) setBalance(null);
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleScan = (payload: string) => {
    setMode('form');
    resolve(payload);
  };

  const handleResolveManual = () => {
    if (!qrPayload) return;
    setMode('form');
    resolve(qrPayload);
  };

  const handleCancel = () => {
    reset();
    setQrPayload('');
    setMode('scan');
  };

  const handleDone = () => {
    reset();
    setQrPayload('');
    setMode('scan');
  };

  const numericAmount = Number(amount);
  const numericBalance = balance ? Number(balance) : null;
  const isInsufficient =
    numericAmount > 0 && numericBalance !== null && numericAmount > numericBalance;

  const canPay =
    !!merchant &&
    !!amount &&
    numericAmount > 0 &&
    !isBusy &&
    !balanceLoading &&
    !isInsufficient &&
    preview?.hasEnoughBalance !== false;

  const renderScan = () => (
    <View className="flex-1">
      <View className="pt-4 pb-2 px-5">
        <Text variant="section">Pay merchant</Text>
        <Text variant="micro" color="secondary" className="mt-1">
          Scan a Seti merchant QR code
        </Text>
      </View>
      <View className="flex-1 mx-5 mb-6 overflow-hidden rounded-card">
        <QrScanner
          onScan={handleScan}
          onManualPress={() => setMode('manual')}
        />
      </View>
    </View>
  );

  const renderManual = () => (
    <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
      <View className="pt-4 pb-6">
        <Text variant="section">Pay merchant</Text>
        <Text variant="micro" color="secondary" className="mt-1">
          Enter the merchant QR payload manually
        </Text>
      </View>

      <View className="gap-4">
        <View>
          <Text variant="micro" color="secondary" className="mb-2">
            Merchant QR or ID
          </Text>
          <TextInput
            value={qrPayload}
            onChangeText={setQrPayload}
            placeholder="seti://pay?merchantId=..."
            autoCapitalize="none"
            className="bg-surface-card border border-border-1 rounded-input px-4 py-3 text-body text-text-primary"
            accessibilityLabel="Merchant QR or ID"
          />
          <Button
            variant="secondary"
            onPress={handleResolveManual}
            className="mt-3"
            disabled={isBusy || !qrPayload}
          >
            Resolve merchant
          </Button>
          {step === 'error' && error ? (
            <Text variant="micro" color="alert" className="mt-2">
              {error}
            </Text>
          ) : null}
          {step === 'insufficient-gas' && error ? (
            <Text variant="micro" color="alert" className="mt-2">
              {error}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="mt-6 mb-6">
        <Button variant="ghost" onPress={() => setMode('scan')}>
          Back to scanner
        </Button>
      </View>
    </ScrollView>
  );

  const renderForm = () => (
    <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
      <View className="pt-4 pb-6">
        <Text variant="section">Pay merchant</Text>
      </View>

      <View className="gap-4">
        {merchant ? (
          <Card>
            <Text variant="card-title">{merchant.name}</Text>
            {merchant.category ? (
              <Text variant="micro" color="secondary">
                {merchant.category}
              </Text>
            ) : null}
          </Card>
        ) : (
          <Card>
            <Text variant="micro" color="secondary">
              Resolving merchant…
            </Text>
          </Card>
        )}

        {/* AmountInput owns inline validation copy (DESIGN.md 4.x: errors are a
            caption in `color-alert`). The wallet/network failure is rendered
            separately below so a precondition failure is not confused with a
            malformed amount, and the two never render at once. */}
        <AmountInput
          value={amount}
          onChangeText={setAmount}
          currency="KES"
          error={errorKind === 'insufficient-gas' ? undefined : (error ?? undefined)}
        />

        {step === 'insufficient-gas' && error ? (
          <Text variant="micro" color="alert">
            {error}
          </Text>
        ) : null}

        {isInsufficient && errorKind !== 'insufficient-gas' ? (
          <Text variant="micro" color="alert">
            Insufficient balance
          </Text>
        ) : null}

        {preview ? (
          <Card className="gap-2">
            <View className="flex-row justify-between">
              <Text variant="body" color="secondary">
                You send
              </Text>
              <Text variant="body" color="primary">
                {preview.total} {preview.totalCurrency}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text variant="body" color="secondary">
                Merchant fee
              </Text>
              <Text variant="body" color="primary">
                {preview.fee} {preview.feeCurrency}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text variant="body" color="secondary">
                Equivalent
              </Text>
              <Text variant="body" color="primary">
                {preview.fiatAmount} {preview.fiatCurrency}
              </Text>
            </View>
          </Card>
        ) : null}
      </View>

      <View className="mt-auto mb-6 gap-3">
        {isBusy ? (
          <View className="items-center justify-center py-3">
            <ActivityIndicator color="#059669" />
            <Text variant="micro" color="secondary" className="mt-2">
              {step === 'previewing'
                ? 'Building preview…'
                : step === 'signing'
                  ? 'Confirm on your wallet…'
                  : step === 'recording'
                    ? 'Recording payment…'
                    : 'Working…'}
            </Text>
          </View>
        ) : (
          <Button
            variant="primary"
            fullWidth
            onPress={pay}
            disabled={!canPay}
          >
            Pay
          </Button>
        )}
        <Button variant="ghost" onPress={handleCancel} disabled={isBusy}>
          Cancel
        </Button>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView className="flex-1 bg-bg-canvas">
      {step === 'done' ? (
        <View className="flex-1 items-center justify-center px-5">
          <Text variant="section">Payment sent</Text>
          {txHash ? (
            <Text variant="micro" color="secondary" className="mt-2 text-center">
              {txHash}
            </Text>
          ) : null}
          <Button variant="primary" onPress={handleDone} className="mt-6">
            Done
          </Button>
        </View>
      ) : mode === 'scan' ? (
        renderScan()
      ) : mode === 'manual' ? (
        renderManual()
      ) : (
        renderForm()
      )}
    </SafeAreaView>
  );
}
