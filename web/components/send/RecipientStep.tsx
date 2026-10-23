'use client';

import { Button, Input, Text } from '@/components/ui';
import { RecentRecipients } from './RecentRecipients';
import { RecipientKindChoice } from './RecipientKindChoice';
import { SEND_FLOW_COPY } from './Send.constants';

/** Which answer the customer gave to the flow's one question. */
export type RecipientKind = 'name' | 'address';

export interface RecipientStepProps {
  kind: RecipientKind;
  value: string;
  /** The field's own error, from the same validation a typed recipient gets. */
  error: string | null;
  busy: boolean;
  onKindChange: (kind: RecipientKind) => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /**
   * Fills the payee with somebody this account has paid before (#99): one tap, and
   * the amount is the only thing left. It is the same string a typed recipient
   * would be, resolved through the same path.
   */
  onPickRecent: (target: string) => void;
}

/**
 * Step one: does the person you are paying have a Seti account?
 *
 * Two answers, and they are the flow's spine — the answer decides what the field
 * asks for and what happens to the value next. A name goes to the server's one
 * resolver (which answers person or merchant), an address is signed as it stands.
 * Asking rather than inferring is what lets the field say which of the two it wants,
 * and a customer pasting a name into an address field is told why.
 *
 * No card: the question, the answers, the field and Continue sit on the page, so the
 * flow's prose is page text rather than the contents of a box. The dark fill is kept
 * only where it MEANS something: the chosen answer, the same selected state
 * `ReceiveSwitch` draws.
 *
 * The repeat block (#99) sits between the field and Continue, and only while the
 * field is empty: someone this account has paid before is a shortcut past this
 * question, and typing is a better answer than anything the list can offer.
 */
export function RecipientStep({
  kind,
  value,
  error,
  busy,
  onKindChange,
  onChange,
  onSubmit,
  onPickRecent,
}: RecipientStepProps) {
  const byName = kind === 'name';
  // The repeat block is a shortcut past this field, so it is drawn only while the
  // field is empty: anything typed here is a better answer than what it offers.
  const fieldIsEmpty = value.trim() === '';

  return (
    <div className="flex flex-col gap-5">
      <Text variant="body" as="p">
        {SEND_FLOW_COPY.question}
      </Text>

      <RecipientKindChoice kind={kind} onKindChange={onKindChange} />

      <Input
        label={byName ? SEND_FLOW_COPY.nameLabel : SEND_FLOW_COPY.addressLabel}
        hint={byName ? SEND_FLOW_COPY.nameHint : SEND_FLOW_COPY.addressHint}
        placeholder={byName ? 'javahouse' : '0x…'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={error ?? undefined}
        disabled={busy}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={byName ? undefined : 'font-mono'}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && value && !busy) onSubmit();
        }}
      />

      <RecentRecipients visible={fieldIsEmpty} disabled={busy} onPick={onPickRecent} />

      <Button onClick={onSubmit} disabled={!value || busy} loading={busy} fullWidth>
        {busy ? SEND_FLOW_COPY.resolving : SEND_FLOW_COPY.continueAction}
      </Button>
    </div>
  );
}
