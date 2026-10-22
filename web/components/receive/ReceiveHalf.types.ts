import type { ReactNode } from 'react';

export interface ReceiveHalfShare {
  title: string;
  /** The absolute link the sheet carries, and the string the fallback copies. */
  url: string;
}

/**
 * One half's geometry: the plate, the name, the field, the actions.
 *
 * The three halves are three different STRINGS with one shape, so the shape lives here
 * once. Each half used to compose its own row, and the address half drifted into a
 * different alignment from the other two, which is how one tab came to read as two
 * products.
 */
export interface ReceiveHalfProps {
  /** The code itself, already configured by the half that owns the payload. */
  plate: ReactNode;
  /** The name, when the half has one worth speaking aloud: a handle or a business. */
  title?: string;
  /** True when the title is a string a sender would type, so it is drawn in mono. */
  monoTitle?: boolean;
  /** The field block: one string, its copy control, and the note under it. */
  field: ReactNode;
  /** The share target for this half. Absent means the half does not offer one. */
  share?: ReceiveHalfShare;
  /**
   * The control that saves the code. Placed here rather than on the plate so nothing
   * sits between the code and the name it stands for.
   */
  download?: ReactNode;
}
