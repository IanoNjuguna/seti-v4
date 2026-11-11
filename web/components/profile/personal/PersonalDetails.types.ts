import type { HandleIdentity } from '@/lib/api';

/** The facts the personal-information screen prints, and the one it can change. */
export interface PersonalDetailsFacts {
  /** The name the account goes by: their own, or the active handle's. */
  name: string;
  /** The stored handle without its `@`, or null when the account holds none. */
  handle: string | null;
  email: string | null;
  phone: string | null;
  /** Business handles the account holds. Listed on the profile page, not here. */
  businesses: HandleIdentity[];
}

/**
 * The screen's one piece of local state: a name being edited.
 *
 * `editing` is the mode, `draft` is what is in the field, and `saving` is the request. They
 * are three states of one thing rather than three flags, which is why they live in one hook:
 * a screen that can be editing while saving while showing the previous error is the shape
 * this avoids.
 */
export interface UsePersonalDetailsReturn extends PersonalDetailsFacts {
  /** True while the name field is open. */
  editing: boolean;
  draft: string;
  saving: boolean;
  /** Why the save failed, in a sentence. Null when there is nothing to say. */
  error: string | null;
  /** True once a save has landed, so the screen can confirm it without a toast system. */
  saved: boolean;
  beginEdit: () => void;
  cancelEdit: () => void;
  changeDraft: (value: string) => void;
  save: () => void;
}
