/** What a share can do, and what it is telling the reader afterwards. */
export type ShareState = 'idle' | 'shared' | 'copied' | 'failed';

export interface UseShareLinkReturn {
  state: ShareState;
  /** Share the string, falling back to the clipboard where the OS sheet is absent. */
  share: () => void;
}
