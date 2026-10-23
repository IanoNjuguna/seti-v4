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
}

/**
 * One receive half's geometry: the code, the name it stands for, then the actions —
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
  /** The one large string under the code: `@handle`, or the business name. */
  headline: string;
  /** Absent means this half hands nothing over by hand — a counter code is printed. */
  copy?: ReceiveHalfCopy;
  /** The share target for this half. Absent means the half does not offer one. */
  share?: ReceiveHalfShare;
  /**
   * The control that saves the code. Placed here rather than on the plate so nothing
   * sits between the code and the name it stands for.
   */
  download?: ReactNode;
}
