import type { UsePayMerchantReturn } from '@/hooks/usePayMerchant.types';
import type { RecipientKind } from './RecipientStep';
import type { ResolvedRecipient } from './useResolvedRecipient';

/**
 * Everything the flow's step body renders from, and nothing else.
 *
 * An explicit props object rather than reading the flow's state directly: which
 * step shows is a DECISION (the recipient question, a failed lookup, the wait for
 * it, a merchant's amount step, or a person's), and keeping the decision's inputs
 * in one interface is what stops the branching from spreading into the screen.
 */
export interface SendStepsProps {
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
  onChangeKind: (kind: RecipientKind) => void;
  onChangeTyped: (value: string) => void;
  onSubmitRecipient: () => void;
  onBackToWho: () => void;
}
