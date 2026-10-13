import { Badge, Text } from '@/components/ui';
import { handleLinkLabel, merchantHandle } from '@/lib/merchant-link';
import type { MerchantHandlePreviewProps } from './ClaimForm.types';

/**
 * The handle a person will get, shown while they type — before they sign.
 *
 * The handle itself is derived locally (the rule is the web's own `merchantHandle`,
 * a mirror of the backend's), so it updates on every keystroke. Whether it is
 * FREE is the backend's answer, because only the backend holds the registry: a
 * taken handle is named here, with its current holder, so it is discovered while
 * editing a name rather than when a customer scans a printed sticker.
 *
 * When the KIND is not known yet (onboarding, before the intent is chosen) this
 * shows the handle itself and says which two links it could become. Printing a URL
 * there would be printing the wrong one half the time — `/m/` for a username
 * points a customer at the shop page.
 */
export function MerchantHandlePreview({
  name,
  preview,
  loading,
  kind,
  copy,
}: MerchantHandlePreviewProps) {
  const handle = merchantHandle(name);

  // Nothing usable to show yet (an empty or punctuation-only name). The field's
  // own validation speaks for this case; a link to `m/` would say nothing.
  if (!handle) return null;

  const problem = preview?.problem ?? null;
  const takenBy = preview?.takenBy ?? null;
  const link = kind ? handleLinkLabel(kind, handle) : handle;

  return (
    <div className="rounded-md bg-surface-soft p-3">
      <Text variant="micro" as="p">
        {kind ? copy.linkLabel : copy.handleLabel}
      </Text>
      <p className="mt-1 break-all font-mono text-body-sm text-ink">{link}</p>

      {kind ? null : (
        <p className="mt-1 text-caption text-stone">{copy.handleKindHint}</p>
      )}

      {problem ? (
        <Text variant="micro" color="alert" as="p" className="mt-2">
          {problem}
        </Text>
      ) : loading ? (
        <Text variant="micro" as="p" className="mt-2">
          {copy.handleChecking}
        </Text>
      ) : takenBy ? (
        <Text variant="micro" color="alert" as="p" className="mt-2">
          {copy.handleTaken(link, takenBy)}
        </Text>
      ) : (
        <div className="mt-2 space-y-2">
          <Badge variant="success">{copy.handleFree}</Badge>
          {/* A free string that matches a held brand is still claimable — but parked. */}
          {preview?.held ? (
            <Text variant="micro" as="p">
              {copy.heldNote}
            </Text>
          ) : null}
        </div>
      )}
    </div>
  );
}
