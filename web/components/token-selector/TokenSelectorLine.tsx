import { ChoiceRow, Text } from '@/components/ui';
import { selectorLine } from './token-selector.model';
import type { TokenSelectorModel } from './TokenSelector.types';

export interface TokenSelectorLineProps {
  model: TokenSelectorModel;
  open: boolean;
  onToggle: () => void;
}

/**
 * The selector closed: ONE line saying which token pays and what it holds (#228).
 *
 * With a single funded balance there is nothing to choose, so it is drawn as a line
 * and not a control — a picker with one option is a tap that teaches nothing. With
 * more, the line itself is the control (`ChoiceRow`), so the whole row is the tap
 * target rather than a small link beside it, and it opens downwards from where the
 * customer is already reading.
 *
 * The figure on the right is the TOKEN's own balance in the customer's currency. It
 * is not the payment amount: that is on the amount field above, and repeating it
 * here would make two figures look like two different prices.
 */
export function TokenSelectorLine({ model, open, onToggle }: TokenSelectorLineProps) {
  const line = selectorLine(model);
  if (line === null) return null;

  if (!model.choosable) {
    return (
      <div className="flex items-baseline justify-between gap-4 px-1">
        <Text variant="micro" as="span" color="secondary">
          {line.label}
        </Text>
        <Text variant="micro" as="span" tabular>
          {line.detail}
        </Text>
      </div>
    );
  }

  return (
    <ChoiceRow
      label={line.label}
      detail={line.detail}
      onSelect={onToggle}
      showChevron
      className={open ? 'bg-surface-soft' : undefined}
    />
  );
}
