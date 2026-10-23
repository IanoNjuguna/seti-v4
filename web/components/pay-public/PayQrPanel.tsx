import { Text } from '@/components/ui';
import { QrPlate } from '@/components/qr/QrPlate';
import { cn } from '@/lib/cn';
import { PAY_COPY, PAY_LINK_CLASS } from './PayPublic.constants';
import type { PayQrPanelProps } from './PayPublic.types';

/**
 * The code, and the string it carries, printed underneath.
 *
 * The plate is the app's ONE QR geometry (`components/qr`): cobalt modules on white, the
 * Seti mark in the middle, and the four-module quiet zone inside the vector rather than
 * in padding around it. Cobalt IS a brand tint, and a tint is normally the first thing
 * that costs a code its decode, so the numbers are held here instead of assumed: `#494fdf`
 * on white is 6.06:1 where black is 21.00:1, and the code keeps 88% of the symbol
 * contrast black would give it. What pays for the rest is that no module loses any of
 * its dark area — rounded corners, full-size modules, neighbours overlapping — and that
 * the error correction is H, which is the budget the mark in the middle is spending.
 * `qr.constants.ts` has the arithmetic; the PR has the decodes it was checked against.
 * A hairline is added here only so the plate has an edge on a white card.
 *
 * `QrPlate` is a client component because the code registers itself for the PNG export,
 * and an export is a browser operation. It still server-renders — the SVG and the exact
 * payload are in the document a JS-disabled browser receives, which is what makes the
 * claim "the code carries the charge" checkable from the served HTML instead of from a
 * live browser.
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
