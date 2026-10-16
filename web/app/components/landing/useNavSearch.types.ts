export interface UseNavSearchReturn {
  /** Whether the ⌘K palette is open. */
  open: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}
