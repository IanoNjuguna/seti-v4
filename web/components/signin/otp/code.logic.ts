import { CODE_LENGTH } from './code.constants';

/**
 * The code's state, as pure functions.
 *
 * No React, no DOM: `check:otp` runs every case below and the component is not allowed
 * to hold a rule of its own. That split is the whole reason this file exists — a cell
 * component that also decided how deletions behave is how an OTP field ends up with a
 * backspace that works on desktop and not on iOS.
 *
 * ## The code is always a contiguous PREFIX
 *
 * `code` is the digits that have landed so far, in order, with no holes. Typing in the
 * middle of a complete code rewrites from that cell and truncates what follows, which
 * is what a person correcting a misread digit expects. Holes are not representable, so
 * `submit` never has to ask which digits are real.
 */

export interface CodeEdit {
  /** The digits to keep, in order, never longer than `CODE_LENGTH`. */
  code: string;
  /** Which cell the caret belongs in after the edit. */
  focus: number;
}

/** Digits only, never longer than the code: pasted text and SMS autofill arrive dirty. */
export function toDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

/** A whole code, and only a whole code, may be submitted. */
export function isComplete(code: string): boolean {
  return toDigits(code).length === CODE_LENGTH;
}

/** Which cell holds a given code's next digit — also where focus belongs on entry. */
export function nextCell(code: string): number {
  return Math.min(toDigits(code).length, CODE_LENGTH - 1);
}

/**
 * A digit typed, or a whole code pasted, at `index`.
 *
 * An empty `raw` is a deletion: `onChange` fires with '' when a cell is cleared, and
 * treating it as "type nothing" would leave the digit visible until the next keystroke.
 */
export function fillDigit(code: string, index: number, raw: string): CodeEdit {
  const typed = toDigits(raw);

  if (typed === '') return deleteAt(code, index);

  // More than one digit at once is a paste or the OS autofilling the SMS code: it
  // replaces the whole thing rather than landing in one cell.
  if (typed.length > 1) {
    return { code: typed, focus: nextCell(typed) };
  }

  const kept = code.slice(0, index);
  const next = (kept + typed).slice(0, CODE_LENGTH);

  return { code: next, focus: nextCell(next) };
}

/**
 * Backspace, and the one case that is not "remove this cell's digit": pressing it in an
 * empty cell steps back and removes the digit before it, because a person clearing a
 * field does not aim at cells, they press backspace until the field is empty.
 */
export function deleteAt(code: string, index: number): CodeEdit {
  const target = index >= code.length && index > 0 ? index - 1 : index;
  const next = code.slice(0, target);

  return { code: next, focus: next.length };
}

/** Arrow navigation, so a code can be corrected without a mouse. */
export function moveFocus(index: number, delta: number): number {
  return Math.min(Math.max(index + delta, 0), CODE_LENGTH - 1);
}
