import { CopyRow } from '@/components/copy/CopyRow';
import { Text } from '@/components/ui';
import { PAYER_COPY } from './PayPublic.constants';
import type { PayRequestDiyProps } from './PayPayer.types';

/**
 * The request as three values, for a wallet that is not this browser.
 *
 * This is the answer to "I have a wallet, but not the Seti app": the address, the
 * amount and the reference, each with the control that copies it. It is the same
 * request the code carries (`seti://pay/<id>`), said in the form every wallet in the
 * world understands, which is why it is drawn under the code rather than instead of
 * it.
 *
 * `CopyRow` is the app's one copy primitive: value visible, control beside it, a
 * failure line instead of a silent no-op when the browser blocks the clipboard, and
 * `wrap` on the address so 42 characters are readable in full. The address is copied
 * in full, never the shortened form drawn above.
 */
export function PayRequestDiy({ values }: PayRequestDiyProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Text variant="micro" as="h3">
          {PAYER_COPY.diyTitle}
        </Text>
        <Text variant="micro" as="p">
          {PAYER_COPY.diyLead}
        </Text>
      </div>

      <RequestRow label={PAYER_COPY.addressLabel} value={values.address} copyLabel={PAYER_COPY.copyAddress} wrap />
      <RequestRow label={PAYER_COPY.amountLabel} value={values.amount} copyLabel={PAYER_COPY.copyAmount} />
      <RequestRow
        label={PAYER_COPY.referenceLabel}
        value={values.reference}
        copyLabel={PAYER_COPY.copyReference}
      />
    </div>
  );
}

interface RequestRowProps {
  label: string;
  value: string;
  copyLabel: string;
  /** The address has to be readable in full, so it wraps rather than truncating. */
  wrap?: boolean;
}

/** A caption naming what the string is, then the string and its copy control. */
function RequestRow({ label, value, copyLabel, wrap = false }: RequestRowProps) {
  return (
    <div className="space-y-1">
      <Text variant="micro" as="p" color="secondary">
        {label}
      </Text>
      <CopyRow
        display={value}
        value={value}
        label={copyLabel}
        failureText={PAYER_COPY.copyFailed}
        copiedText={PAYER_COPY.copied}
        wrap={wrap}
      />
    </div>
  );
}
