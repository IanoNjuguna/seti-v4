import type { ReactNode } from 'react';

export interface ReceiveHalfShare {
  title: string;
  /**
   * The string the OS sheet carries, and what the clipboard takes when the sheet is
   * missing. It is the resolvable link, never the username: a chat recipient handed
   * `ian` cannot pay anyone, so this is the one place a link still leaves the page.
   */
  url: string;
}

/** The bare string a half hands over, and the words it does it in. */
export interface ReceiveHalfCopy {
  /** What the control writes: the handle with no `@`, exactly as a sender types it. */
  value: string;
  /** The control's accessible name. The glyph on screen says nothing on its own. */
  label: string;
  /** The announcement after a copy lands, so a pointer user is not guessing. */
  confirmed: string;
  /**
   * The line shown when the browser refuses the clipboard.
   *
   * Per half rather than shared, because the sentence tells the reader which string to
   * select by hand, and the two halves do not carry the same string: "select your
   * username above" is wrong on a screen printing a merchant name and a handle.
   */
  failed: string;
}

/**
 * The named row under the code: what the string is CALLED, the string, and the control
 * that takes it.
 *
 * The label is not decoration. This page shows one of two strings depending on which half
 * is on screen, and they are different kinds of fact — a user name another Seti account
 * types, and the name a customer pays at a counter. Unlabelled, `@ian` and `@javahouse`
 * sat under identical codes and nothing on the page said which one the reader was
 * looking at.
 *
 * BOTH HALVES PRINT A HANDLE, so the row has one shape: a label, a handle, the glyph.
 * The merchant row briefly printed its business name plus the handle after it, which made
 * the two halves differ in length and in kind; the owner's call is that the string a
 * person pays is the one worth giving them, and the business name stays where a customer
 * reads it — the code's own title and the share sheet.
 */
export interface ReceiveHalfName {
  /** The word the row calls the string by: `User name`, `Merchant name`. */
  label: string;
  /** The handle as it is printed: `@ian`, `@javahouse`. Never the business name. */
  value: string;
  /** Absent means this half hands nothing over by hand — a counter code is printed. */
  copy?: ReceiveHalfCopy;
}

/**
 * One receive half's geometry: the code, the named row it stands for, then the actions —
 * on ONE axis, and that axis is the centre.
 *
 * The three halves of the old page shared this shape and one of them drifted into a
 * different alignment, which is how one tab came to read as a second product. Two
 * halves are left and they are one object with two strings, so the geometry lives
 * here once and both compose it.
 */
export interface ReceiveHalfProps {
  /** The code itself, already configured by the half that owns the payload. */
  plate: ReactNode;
  /** The row under the code: the label, the string, and the control that takes it. */
  name: ReceiveHalfName;
  /** The share target for this half. Absent means the half does not offer one. */
  share?: ReceiveHalfShare;
  /**
   * The control that saves the code. It sits UNDER the action row rather than in it:
   * saving is the rarer alternative to handing the code over, and it is the one action
   * here that leaves nothing for the other person (#549).
   */
  download?: ReactNode;
  /**
   * The second action, when this half can put a figure on the code (#498): asking for a
   * specific amount is the same job as handing the code over, so it shares the row with
   * Share rather than sitting under the page as a separate block.
   */
  claim?: ReactNode;
}
