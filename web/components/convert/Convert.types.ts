import type { SupportedAsset } from '@/lib/chain';
import type { ConvertPreview } from '@/lib/api';
import type { IconName } from '@/components/ui/icon-paths.constants';
import type { ConvertResult, ConvertStatus } from '@/hooks/useConvert.types';

export interface ConvertFieldProps {
  label: string;
  id: string;
  /** The figure in the field: what the customer typed, or what they will receive. */
  amount: string;
  /** Omitted on the receive side — that figure is the server's, not the customer's. */
  onAmountChange?: (amount: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  /** The currency word beside the figure (`KES`). */
  currencyPrefix: string;
  asset: SupportedAsset;
  assets: readonly SupportedAsset[];
  onAssetChange: (asset: SupportedAsset) => void;
  selectLabel: string;
  hint?: string;
}

export interface ConvertNoteProps {
  preview: ConvertPreview | null;
  assetOut: SupportedAsset;
  quoting: boolean;
  /** The sentence a refusal produced, if any. Wins over every other line. */
  error: string | null;
}

export interface ConvertPanelProps {
  convert: import('@/hooks/useConvert.types').UseConvertReturn;
}

export interface ConvertResultProps {
  result: ConvertResult;
  onAgain: () => void;
}

export interface ConvertActionProps {
  status: ConvertStatus;
  canSubmit: boolean;
  onConvert: () => void;
}

export interface ConvertFlipProps {
  onClick: () => void;
  label: string;
  icon: IconName;
}
