'use client';

import { Input, Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import { ASK_COPY } from './ask.constants';
import type { AskDetailsProps } from './ask.types';

/**
 * What the amount is for, who it goes to, and how long the link lives (#465).
 *
 * The payee is a choice, not a constant: an account can hold a person handle and a business handle at
 * once, and the ask names whichever one it is written for. It renders as chips only when there is more
 * than one, because a single option is not a choice and a disabled strip would be a control that
 * cannot be used.
 *
 * Expiry is a chip row rather than a date field. A person asking for rent does not think in timestamps,
 * and the three answers that matter are a week, a month, or never. The days go to the server, which
 * validates the window itself and refuses a past one; `null` is the explicit "never lapses" rather
 * than a very large number standing in for it.
 */
export function AskDetails({
  memo,
  expiresInDays,
  disabled,
  payees,
  payee,
  onMemo,
  onExpiry,
  onPayee,
}: AskDetailsProps) {
  return (
    <div className="flex flex-col gap-4">
      <Input
        label={ASK_COPY.memoLabel}
        placeholder={ASK_COPY.memoPlaceholder}
        value={memo}
        maxLength={200}
        disabled={disabled}
        onChange={(event) => onMemo(event.target.value)}
      />

      {payees.length > 1 ? (
        <fieldset className="flex flex-col gap-2">
          <Text variant="micro" as="p" color="secondary">
            {ASK_COPY.payeeLabel}
          </Text>
          <div className="flex flex-wrap gap-2">
            {payees.map((option) => (
              <Chip
                key={option.handle}
                label={option.name}
                selected={option.handle === payee}
                disabled={disabled}
                onSelect={() => onPayee(option.handle)}
              />
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <Text variant="micro" as="p" color="secondary">
          {ASK_COPY.expiryLabel}
        </Text>
        <div className="flex gap-2">
          {ASK_COPY.expiryOptions.map((option) => (
            <Chip
              key={option.label}
              label={option.label}
              selected={option.days === expiresInDays}
              disabled={disabled}
              onSelect={() => onExpiry(option.days)}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}

interface ChipProps {
  label: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}

/** A 44px choice. Selected is a surface change plus an ink change, never colour alone. */
function Chip({ label, selected, disabled, onSelect }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'flex min-h-11 items-center rounded-md border px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light disabled:opacity-40',
        selected ? 'border-ink bg-surface-soft' : 'border-hairline-light hover:border-hairline-strong'
      )}
    >
      <Text variant="micro" as="span" color={selected ? 'primary' : 'secondary'}>
        {label}
      </Text>
    </button>
  );
}
