import { Text } from '@/components/ui';
import { QrPlate } from '@/components/qr/QrPlate';
import { PAY_COPY } from './PayPublic.constants';
import type { PayQrPanelProps } from './PayPublic.types';

/**
 * The code, and the string it carries, printed underneath.
 *
 * The plate is the app's ONE QR geometry (`components/qr`): black on white, with the
 * quiet zone in its padding, because the contrast and the margin are what make a code
 * readable and a brand tint is what stops one being read. A hairline is added here
 * only so the plate has an edge on a white card.
 *
 * `QrPlate` is a client component because `react-qr-code` is a class component, and it
 * still server-renders — the SVG and the exact payload are in the document a
 * JS-disabled browser receives, which is what makes the claim "the code carries the
 * charge" checkable from the served HTML instead of from a live browser.
 *
 * The URI is repeated as text: a payer on a laptop reading a code on the same screen
 * cannot scan it, and "open this in Seti" is instruction they can follow by hand.
 */
export function PayQrPanel({ uri, title }: PayQrPanelProps) {
  return (
    <div className="space-y-3">
      <Text variant="micro" as="p">
        {PAY_COPY.scanCaption}
      </Text>

      <QrPlate value={uri} title={title} className="mx-auto border border-hairline-light" />

      <Text variant="micro" as="p" className="break-all font-mono">
        {PAY_COPY.uriCaption}: {uri}
      </Text>
    </div>
  );
}
