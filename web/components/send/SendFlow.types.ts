import type { UsePayMerchantReturn } from '@/hooks/usePayMerchant.types';
import type { RecipientKind } from './RecipientStep';
import type { ResolvedRecipient } from './useResolvedRecipient';

export interface SendFlowProps {
  /** The recipient named by the URL (`?to=` / `?handle=`), if the link had one. */
  linked: string | null;
}

/** What the flow is handed: the link's own seed, and nothing else. */
export interface SendFlowInput {
  linked: string | null;
}

/**
 * Everything the flow's step body renders from, and nothing else.
 *
 * The step's own state, the resolution in flight, and the account's pay machinery,
 * in one interface: the screen above reads this and decides nothing twice.
 */
export interface UseSendFlowReturn {
  kind: RecipientKind;
  /** What has been typed into the recipient field. */
  typed: string;
  /** The field's own error — never a wallet or server message. */
  error: string | null;
  /** The chosen recipient, or null while step one is still being asked. */
  recipient: string | null;
  isAddress: boolean;
  resolved: ResolvedRecipient;
  payment: UsePayMerchantReturn;
  /**
   * Whether the amount field should take focus when it mounts.
   *
   * True when the payee arrived ALREADY KNOWN — a link that named them, or a tap on
   * someone this account has paid before (#99). The payee is the answered question
   * in both cases, so the amount is the only thing left to type and the cursor is
   * put where the typing goes.
   */
  focusAmount: boolean;
  onChangeKind: (kind: RecipientKind) => void;
  onChangeTyped: (value: string) => void;
  onSubmitRecipient: () => void;
  onBackToWho: () => void;
  /** A tap on someone paid before: fills the payee, and nothing else. */
  onPickRecent: (target: string) => void;
}
