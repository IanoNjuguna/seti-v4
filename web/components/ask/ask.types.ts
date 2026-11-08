import type { CreatedAsk } from '@/lib/api/requests';

/**
 * The ask screen's props and the shape its hook returns.
 *
 * Split from the components so the screen, the figure, the details and the result can each be read
 * without the other three: the screen wires, the parts draw.
 */

/** One of the caller's own handles, which is what an ask can be paid to. */
export interface AskPayee {
  handle: string;
  /** The username or business name a payer sees. */
  name: string;
}

/** What the form holds while it is being filled. */
export interface AskDraft {
  payee: string;
  amount: string;
  memo: string;
  /** Days from now, or `null` for an ask that never lapses. */
  expiresInDays: number | null;
}

export type AskPhase = 'loading' | 'editing' | 'saving' | 'shared';

export interface UseAskReturn {
  phase: AskPhase;
  draft: AskDraft;
  payees: AskPayee[];
  /** Set once the ask exists: the record and the link a payer opens. */
  created: CreatedAsk | null;
  link: string;
  /** Copy of the refusals the server returns, in the caller's terms. */
  error: string | null;
  canSubmit: boolean;
  setPayee: (handle: string) => void;
  setAmount: (amount: string) => void;
  setMemo: (memo: string) => void;
  setExpiry: (days: number | null) => void;
  submit: () => void;
  restart: () => void;
}

export interface AskFigureProps {
  amount: string;
  disabled: boolean;
  onAmount: (next: string) => void;
  error: string | null;
}

export interface AskDetailsProps {
  memo: string;
  expiresInDays: number | null;
  disabled: boolean;
  payees: AskPayee[];
  payee: string;
  onMemo: (memo: string) => void;
  onExpiry: (days: number | null) => void;
  onPayee: (handle: string) => void;
}

export interface AskResultProps {
  created: CreatedAsk;
  link: string;
  onAnother: () => void;
}
