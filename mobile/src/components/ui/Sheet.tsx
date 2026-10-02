import { Modal, Pressable, View } from 'react-native';
import { cn } from '@/lib/cn';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Simplified bottom sheet for scaffold.
 * Swaps to a centered modal on narrow viewports; replace with a proper
 * bottom-sheet library (e.g. @gorhom/bottom-sheet) once gesture needs grow.
 */
export function Sheet({ visible, onClose, children, className }: SheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable
        onPress={onClose}
        className="flex-1 bg-[rgba(15,23,42,0.4)] justify-end"
        accessibilityLabel="Close sheet"
      >
        <View
          className={cn(
            'bg-surface-card rounded-t-sheet pt-2 px-5 pb-8 shadow-sheet',
            className
          )}
        >
          <View className="w-9 h-1 bg-surface-inset rounded-full self-center mb-4" />
          {children}
        </View>
      </Pressable>
    </Modal>
  );
}
