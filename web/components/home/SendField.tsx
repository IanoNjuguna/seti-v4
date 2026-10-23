'use client';

import { Input } from '@/components/ui/Input';
import type { SendFieldProps } from './SendPanel.types';

/**
 * One labelled field, on the page's own white canvas.
 *
 * A thin wrapper over `components/ui/Input` with `tone` left at its `light` default,
 * because the amount step draws on `canvas-light`. This used to be
 * a second implementation of the same field — label bound by id, message addressable
 * through `aria-describedby`, `aria-invalid` when refused — because the primitive was
 * light-canvas only; two copies of an accessibility contract is how the two drift.
 *
 * What stays local is only what is genuinely about THIS field: an address is monospace
 * and refuses autocomplete, autocapitalisation and spellcheck, and a fiat amount asks
 * for the numeric keyboard. Everything else is the primitive's.
 */
export function SendField({
  label,
  hint,
  error,
  value,
  onChange,
  inputMode = 'text',
  mono = false,
  disabled,
  autoFocus = false,
}: SendFieldProps) {
  return (
    <Input
      label={label}
      hint={hint ?? undefined}
      error={error ?? undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      inputMode={inputMode}
      disabled={disabled}
      autoFocus={autoFocus}
      autoComplete="off"
      autoCapitalize={mono ? 'none' : undefined}
      autoCorrect={mono ? 'off' : undefined}
      spellCheck={mono ? false : undefined}
      className={mono ? 'font-mono text-body-sm' : undefined}
    />
  );
}
