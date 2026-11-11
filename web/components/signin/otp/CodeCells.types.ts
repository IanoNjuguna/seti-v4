import type { ChangeEvent, ClipboardEvent, KeyboardEvent, RefObject } from 'react';

export interface CodeCellsProps {
  /** The digits so far, contiguous, at most `CODE_LENGTH` long. */
  code: string;
  /** The last submit was refused: borders carry the state, the sentence lives above. */
  error?: boolean;
  /** The code is being checked; the cells keep their digits and stop taking input. */
  disabled?: boolean;
  /** Every edit, so the screen owns the value. */
  onCodeChange: (code: string) => void;
  /** The sixth digit landed — auto-submit, which is the reference's behaviour. */
  onComplete: (code: string) => void;
}

export interface UseCodeCellsReturn {
  /** One ref per cell, for the caret moves `code.logic` decides. */
  refs: RefObject<Array<HTMLInputElement | null>>;
  onChange: (index: number, event: ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (index: number, event: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (index: number, event: ClipboardEvent<HTMLInputElement>) => void;
}
