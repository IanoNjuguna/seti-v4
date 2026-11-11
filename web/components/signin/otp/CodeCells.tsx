'use client';

import { cn } from '@/lib/cn';
import {
  CELL_BASE_CLASS,
  CELL_EMPTY_EXTRA_CLASS,
  CELL_ROW_CLASS,
  CODE_FIELD_LABEL,
  CODE_LENGTH,
  cellLabel,
} from './code.constants';
import { nextCell } from './code.logic';
import { useCodeCells } from './useCodeCells';
import type { CodeCellsProps } from './CodeCells.types';

/**
 * The emailed code, as six cells — the shape the reference uses and the shape a person
 * expects from a one-time code on a phone.
 *
 * A single field holding six digits was the previous treatment, and it was not wrong so
 * much as unreadable at a glance: nothing on the screen said how long the code is, so
 * "did I paste all of it" had no answer. Six cells answer that by existing, and each one
 * carries its position for a screen reader (`Digit 3 of 6`) because a lone digit names
 * nothing.
 *
 * The row is a `fieldset` with a `legend` that is only for assistive tech: the visible
 * heading above already says what is being asked, and repeating it here would be the
 * same sentence twice on a 384px column.
 */
export function CodeCells({ code, error = false, disabled = false, onCodeChange, onComplete }: CodeCellsProps) {
  const { refs, onChange, onKeyDown, onPaste } = useCodeCells({ code, onCodeChange, onComplete });

  return (
    <fieldset className={CELL_ROW_CLASS} disabled={disabled}>
      <legend className="sr-only">{CODE_FIELD_LABEL}</legend>
      {Array.from({ length: CODE_LENGTH }, (_unused, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          value={code[index] ?? ''}
          onChange={(event) => onChange(index, event)}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={(event) => onPaste(index, event)}
          onFocus={(event) => event.currentTarget.select()}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={index === nextCell(code) ? 'one-time-code' : 'off'}
          aria-label={cellLabel(index)}
          aria-invalid={error ? true : undefined}
          className={cn(
            CELL_BASE_CLASS,
            CELL_EMPTY_EXTRA_CLASS,
            disabled && 'cursor-not-allowed opacity-60'
          )}
        />
      ))}
    </fieldset>
  );
}
