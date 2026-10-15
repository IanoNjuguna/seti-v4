'use client';

import { useState } from 'react';
import { Button, Card, Input } from '@/components/ui';

export interface MerchantEntryProps {
  onResolve: (payload: string) => void;
  /** Set when resolution failed, so the field can carry the message. */
  error?: string | null;
  disabled?: boolean;
}

/**
 * Manual merchant entry — the only entry path on the web today.
 *
 * The mobile screen also offers a camera scanner; a browser camera path is a
 * separate decision (does the web client need it at all?), so this ships the
 * paste-a-code flow first. It is not a downgrade for testing either: manual entry
 * accepts the same three formats the QR carries.
 *
 * Parsing happens server-side (`GET /merchants/resolve`), so this component sends
 * the string verbatim and reports whatever the backend says.
 *
 * The placeholder is a merchant's name as a person would type it (`kfc`), NOT a
 * `seti://` URL. A scheme in the placeholder was the first thing it showed, and it
 * read as the only accepted input — which the field's own label refuses ("Merchant
 * name or link"), and which is the opposite of what a sticker-carrying merchant
 * types. A real name, lower case as handles are, shows the field's everyday use.
 *
 * The card is the FORM ONLY. The heading above it belongs to the page
 * (`PayHeading`), because the same words are the page's title once a merchant
 * resolves — see that component. It also used to carry a second set of
 * instructions under the field ("Accepts a name, or a seti:// link.") echoing the
 * sentence already above it: two lines saying one thing, which is what made this
 * card read as three levels of the same note. One instruction, one field, one
 * action.
 */
export function MerchantEntry({ onResolve, error, disabled }: MerchantEntryProps) {
  const [payload, setPayload] = useState('');

  return (
    <Card className="space-y-4">
      <Input
        label="Merchant name or link"
        placeholder="kfc"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={payload}
        onChange={(event) => setPayload(event.target.value)}
        error={error ?? undefined}
        disabled={disabled}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && payload && !disabled) onResolve(payload);
        }}
      />

      <Button onClick={() => onResolve(payload)} disabled={!payload || disabled} fullWidth>
        Find merchant
      </Button>
    </Card>
  );
}
