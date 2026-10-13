import { Badge, Text } from '@/components/ui';
import { merchantHandle, merchantLink } from '@/lib/merchant-link';
import { CLAIM_COPY } from './Claim.constants';
import type { MerchantHandlePreviewProps } from './ClaimForm.types';

/**
 * The link the merchant will get, shown while they type — before they sign.
 *
 * The link itself is derived locally (the rule is the web's own `merchantHandle`,
 * a mirror of the backend's), so it updates on every keystroke. Whether it is
 * FREE is the backend's answer, because only the backend holds the registry: a
 * taken link is named here, with its current holder, so it is discovered while
 * editing a name rather than when a customer scans a printed sticker.
 */
export function MerchantHandlePreview({ name, preview, loading }: MerchantHandlePreviewProps) {
  const handle = merchantHandle(name);

  // Nothing usable to show yet (an empty or punctuation-only name). The field's
  // own validation speaks for this case; a link to `m/` would say nothing.
  if (!handle) return null;

  const problem = preview?.problem ?? null;
  const takenBy = preview?.takenBy ?? null;

  return (
    <div className="rounded-md bg-surface-soft p-3">
      <Text variant="micro" as="p">
        {CLAIM_COPY.linkLabel}
      </Text>
      <p className="mt-1 break-all font-mono text-body-sm text-ink">{merchantLink(name)}</p>

      {problem ? (
        <p className="mt-2 text-body-sm text-accent-danger">{problem}</p>
      ) : loading ? (
        <Text variant="micro" as="p" className="mt-2">
          {CLAIM_COPY.handleChecking}
        </Text>
      ) : takenBy ? (
        <p className="mt-2 text-body-sm text-accent-danger">
          {CLAIM_COPY.handleTaken(handle, takenBy)}
        </p>
      ) : (
        <div className="mt-2">
          <Badge variant="success">{CLAIM_COPY.handleFree}</Badge>
        </div>
      )}
    </div>
  );
}
