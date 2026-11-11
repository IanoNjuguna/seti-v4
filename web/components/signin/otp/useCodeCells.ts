'use client';

import { useCallback, useRef } from 'react';
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from 'react';
import { deleteAt, fillDigit, isComplete, moveFocus } from './code.logic';
import type { CodeEdit } from './code.logic';
import type { UseCodeCellsReturn } from './CodeCells.types';

/**
 * The cells' behaviour: where the caret goes, and when the code is done.
 *
 * Every rule lives in `code.logic`; this hook is the DOM half — refs, events, and one
 * place that decides when a finished code is handed up. That boundary is what
 * `check:otp` can assert without a browser: the logic is pure, and what is left here is
 * three thin handlers.
 *
 * The caret is moved by `focus()`, never by `autoFocus`: a cell that mounts focused is
 * a field that opens the keyboard on arrival, and this screen is reached by a deliberate
 * action but read before it is typed into.
 */
export function useCodeCells({
  code,
  onCodeChange,
  onComplete,
}: {
  code: string;
  onCodeChange: (code: string) => void;
  onComplete: (code: string) => void;
}): UseCodeCellsReturn {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  /** Apply an edit from the logic AND put the caret where it says — one path, no drift. */
  const apply = useCallback(
    (edit: CodeEdit) => {
      onCodeChange(edit.code);
      refs.current[edit.focus]?.focus();
      if (isComplete(edit.code)) onComplete(edit.code);
    },
    [onCodeChange, onComplete]
  );

  const onChange = useCallback(
    (index: number, event: ChangeEvent<HTMLInputElement>) => {
      apply(fillDigit(code, index, event.target.value));
    },
    [apply, code]
  );

  const onKeyDown = useCallback(
    (index: number, event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Backspace') {
        // Handled here rather than by the field, because an empty cell would otherwise
        // delete nothing and the backspace that clears the last digit would do nothing.
        event.preventDefault();
        apply(deleteAt(code, index));
        return;
      }

      const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
      if (step !== 0) {
        event.preventDefault();
        refs.current[moveFocus(index, step)]?.focus();
      }
    },
    [apply, code]
  );

  const onPaste = useCallback(
    (index: number, event: ClipboardEvent<HTMLInputElement>) => {
      event.preventDefault();
      apply(fillDigit(code, index, event.clipboardData.getData('text')));
    },
    [apply, code]
  );

  return { refs, onChange, onKeyDown, onPaste };
}
