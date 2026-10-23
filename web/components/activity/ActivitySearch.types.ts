import type { RefObject } from 'react';

/**
 * The query as the screen uses it, and the one object both the field and the
 * list read from so they cannot disagree about what is being searched for.
 *
 * `value` and `query` are deliberately two: the field shows what the person
 * typed (spacing, capitalisation and all), while the list matches the trimmed,
 * lowercased form. Normalising in the field would fight the caret.
 */
export interface ActivitySearchBase {
  /** Exactly what is in the field. */
  value: string;
  /** The form the list matches against. Empty means the whole history. */
  query: string;
  setValue: (value: string) => void;
  /** Empties the query and puts the caret back in the field. */
  clear: () => void;
  /** The input itself, so a clear from the no-match message lands where typing does. */
  inputRef: RefObject<HTMLInputElement | null>;
}

/** The query plus the sentence a screen reader hears when the count changes. */
export interface ActivitySearchState extends ActivitySearchBase {
  /** Empty when nothing is typed, so an unfiltered list announces nothing. */
  status: string;
}

export interface ActivitySearchFieldProps {
  search: ActivitySearchState;
}

export interface ActivityNoMatchesProps {
  search: ActivitySearchState;
  /** Older pages are still unloaded, so the search has not seen the whole history. */
  canLoadMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}
