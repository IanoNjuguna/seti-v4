import { Text } from '@/components/ui';
import { PAY_COPY } from './PayPublic.constants';
import type { PayFacilitatorNoteProps } from './PayPublic.types';

/**
 * What Seti did, and which request this is. Drawn on BOTH tiers, always.
 *
 * This is the anti-phishing line, and it is the reason a stranger's page can carry our
 * mark at all. It says what WE did — rendered the request, and (once the money arrives)
 * checked the transfer — and never who the recipient is. The payer's defence is the two
 * facts next to it: the address above, which is where the money goes, and this id, which
 * the shop can quote back. A person who has been sent a fake link has one thing to compare.
 *
 * It is a claim about our action, so it stays true of a page nobody verified. Removing it
 * from the verified tier would turn the mark itself into the trust signal, which is the
 * failure #154 exists to prevent — hence one component, drawn twice, not two lines.
 */
export function PayFacilitatorNote({ chargeId }: PayFacilitatorNoteProps) {
  return (
    <div className="mt-3 space-y-1">
      <Text variant="micro" as="p" color="secondary">
        {PAY_COPY.facilitatedBy}
      </Text>
      <p className="font-mono text-body-sm text-charcoal">
        <span className="text-mute">{PAY_COPY.requestLabel}</span> {chargeId}
      </p>
    </div>
  );
}
