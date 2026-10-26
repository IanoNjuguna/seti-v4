import { ChoiceRow } from '@/components/ui';
import { TOKEN_SELECTOR_COPY } from './TokenSelector.constants';
import type { TokenSelectorModel } from './TokenSelector.types';

export interface TokenSelectorOptionsProps {
  model: TokenSelectorModel;
  onChoose: (asset: string) => void;
}

/**
 * The balances, one row each, opened under the line.
 *
 * Only FUNDED rows are here: an empty balance is not an option, and a row that
 * cannot be chosen is a row that wastes the tap. The row in force carries
 * `selected`, which is what tells the customer which one the price is already for —
 * the model's `paying`, never a private copy of the choice.
 *
 * Row order is the server's (`pickSpendAsset` reads the primary first), so the list
 * as drawn is also the order an unpinned payment spends in.
 */
export function TokenSelectorOptions({ model, onChoose }: TokenSelectorOptionsProps) {
  return (
    <div className="space-y-2" role="group" aria-label={TOKEN_SELECTOR_COPY.choose}>
      {model.options.map((option) => (
        <ChoiceRow
          key={option.asset}
          label={option.symbol}
          detail={`${TOKEN_SELECTOR_COPY.holds} ${option.held}`}
          selected={option.asset === model.paying?.asset}
          onSelect={() => onChoose(option.asset)}
        />
      ))}
    </div>
  );
}
