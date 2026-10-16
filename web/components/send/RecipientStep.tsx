'use client';

import { Button, Input, Text } from '@/components/ui';
import { cn } from '@/lib/cn';
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
}

/**
 * Step one: does the person you are paying have a Seti account?
 *
 * Two answers, and they are the flow's spine — the answer decides what the field
 * asks for and what happens to the value next. A name goes to the server's one
 * resolver (which answers person or merchant), an address is signed as it stands.
 *
 * The question is asked rather than inferred from what gets typed, because the
 * consequence differs: a name is looked up and must resolve, an address is not
 * looked up at all. Asking first means the field can say which of the two it
 * wants, and a customer pasting a name into an address field is told why.
 *
 * The two answers are pressed-state buttons (never colour alone: `aria-pressed`
 * says which is chosen), and the field keeps focus after the choice changes, so
 * choosing does not cost a tap back into the input.
 *
 * No card. The question, the two answers, the field and the Continue control sit
 * directly on the page — the same call the receive halves make — so the flow's prose
 * is page text rather than the contents of a box. The dark fill is kept only where
 * it MEANS something: the chosen answer, which is the same selected state
 * `ReceiveSwitch` draws, and the step's own progress fill.
 */
export function RecipientStep({
  kind,
  value,
  error,
  busy,
  onKindChange,
  onChange,
  onSubmit,
}: RecipientStepProps) {
  const byName = kind === 'name';

  return (
    <div className="flex flex-col gap-5">
      <Text variant="body" as="p">
        {SEND_FLOW_COPY.question}
      </Text>

      <div role="group" aria-label={SEND_FLOW_COPY.question} className="flex flex-col gap-2">
        {([true, false] as const).map((isName) => {
          const active = isName === byName;

          return (
            <button
              key={isName ? 'name' : 'address'}
              type="button"
              aria-pressed={active}
              onClick={() => onKindChange(isName ? 'name' : 'address')}
              className={cn(
                'min-touch w-full rounded-md px-4 py-3 text-left text-body-sm font-semibold transition-colors',
                // The press is answered on pointer-DOWN with the system's own
                // pressed step (`Button.constants.ts`): an instant 2% scale, the
                // same one every other control in the app answers with. Without
                // it the choice was hover-only, so a touch user got nothing back
                // until the step changed under them.
                'active:scale-[0.98]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light',
                active
                  ? 'bg-canvas-dark text-on-dark'
                  : 'bg-surface-soft text-ink hover:bg-faint'
              )}
            >
              {isName ? SEND_FLOW_COPY.byName : SEND_FLOW_COPY.byAddress}
            </button>
          );
        })}
      </div>

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

      <Button onClick={onSubmit} disabled={!value || busy} loading={busy} fullWidth>
        {busy ? SEND_FLOW_COPY.resolving : SEND_FLOW_COPY.continueAction}
      </Button>
    </div>
  );
}
