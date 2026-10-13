import type { ComponentType, CSSProperties } from 'react';
import QRCodeBase from 'react-qr-code';

/**
 * The props this app uses from `react-qr-code`.
 *
 * Declared here rather than imported: the library's shipped declaration resolves
 * its `React` against a copy that is not present at this level, so its `QRCodeProps`
 * loses the SVG props and its class export fails React 19's JSX check. The runtime
 * export is a plain forwardRef component that accepts exactly these, so this types
 * the module at the boundary we use.
 *
 * In its own module so every QR surface in the app goes through ONE cast. A second
 * cast somewhere else is a second place that breaks when the library's types are
 * fixed (or when it is replaced).
 */
export interface MerchantQrCodeProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  bgColor?: string;
  fgColor?: string;
  title?: string;
  style?: CSSProperties;
  className?: string;
}

/** Type-only cast of the default export; the runtime component is unchanged. */
export const QRCode = QRCodeBase as unknown as ComponentType<MerchantQrCodeProps>;
