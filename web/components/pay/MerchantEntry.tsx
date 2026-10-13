'use client';

import { useState } from 'react';
import { Button, Card, Input, Text } from '@/components/ui';

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
 * the string verbatim and reports whatever the backend says. Accepted formats are
 * shown as a hint because an unparseable string is the most likely user error.
 */
export function MerchantEntry({ onResolve, error, disabled }: MerchantEntryProps) {
  const [payload, setPayload] = useState('');

  return (
    <Card className="space-y-4">
      <div>
        <Text variant="section" as="h2">
          Pay merchant
        </Text>
        <Text variant="micro" as="p" className="mt-1">
          Type the merchant’s name, or paste the link they gave you.
        </Text>
      </div>

      <Input
        label="Merchant name or link"
        placeholder="seti://merchant?name=…"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={payload}
        onChange={(event) => setPayload(event.target.value)}
        hint="Accepts a name, or a seti:// link."
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
