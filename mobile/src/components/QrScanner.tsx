import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button } from '@/components/ui';

interface QrScannerProps {
  onScan: (payload: string) => void;
  onManualPress?: () => void;
}

export function QrScanner({ onScan, onManualPress }: QrScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanned, setScanned] = useState(false);

  const handleBarcodeScanned = (result: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    onScan(result.data);
  };

  if (!permission) {
    return <View className="flex-1 bg-black" />;
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center px-6 gap-4">
        <Text variant="section" className="text-center">
          Camera access needed
        </Text>
        <Text variant="body" color="secondary" className="text-center">
          Grant camera permission to scan merchant QR codes.
        </Text>
        <Button variant="primary" onPress={requestPermission}>
          Grant permission
        </Button>
        {onManualPress ? (
          <Button variant="ghost" onPress={onManualPress}>
            Enter manually
          </Button>
        ) : null}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        className="flex-1"
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      <View className="absolute inset-0 pointer-events-none">
        <View className="flex-1 bg-black/40" />
        <View className="h-64 flex-row">
          <View className="flex-1 bg-black/40" />
          <View className="h-64 w-64 rounded-2xl border-2 border-white/80" />
          <View className="flex-1 bg-black/40" />
        </View>
        <View className="flex-1 bg-black/40" />
      </View>

      <View className="absolute top-12 right-4">
        <Pressable
          onPress={() => setTorch((prev) => !prev)}
          className="rounded-full bg-black/50 p-3"
          accessibilityRole="button"
          accessibilityLabel={torch ? 'Turn torch off' : 'Turn torch on'}
        >
          <Ionicons
            name={torch ? 'flash' : 'flash-off'}
            size={24}
            color="white"
          />
        </Pressable>
      </View>

      <View className="absolute bottom-8 left-0 right-0 gap-3 px-6">
        <Text variant="micro" color="secondary" className="text-center">
          Position the QR code inside the frame
        </Text>
        {onManualPress ? (
          <Button variant="secondary" onPress={onManualPress}>
            Enter manually
          </Button>
        ) : null}
      </View>
    </View>
  );
}
