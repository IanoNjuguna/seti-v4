import { Text } from '@/components/ui';
import { QrPlate } from '@/components/qr/QrPlate';
import { cn } from '@/lib/cn';
import { PAY_COPY, PAY_LINK_CLASS } from './PayPublic.constants';
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
 * The payload is also an ANCHOR (#153). A phone that has a wallet understands
 * `seti://pay/<id>` and hands it straight over; a laptop cannot scan a code on its own
 * screen, and a link is instruction it can follow. The same string stays visible as
 * text for anyone who has to type it, and it works with JavaScript off because it is
 * an anchor, not a button.
 */
export function PayQrPanel({ uri, title }: PayQrPanelProps) {
  return (
    <div className="space-y-3">
      <Text variant="micro" as="p">
        {PAY_COPY.scanCaption}
      </Text>

      <QrPlate value={uri} title={title} className="mx-auto border border-hairline-light" />

      <div className="space-y-1">
        <Text variant="micro" as="p">
          {PAY_COPY.uriCaption}
        </Text>
        <a href={uri} className={cn(PAY_LINK_CLASS, 'break-all font-mono')}>
          {uri}
        </a>
      </div>
    </div>
  );
}
