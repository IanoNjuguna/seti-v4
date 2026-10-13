import { Text } from './Text';
import { shortenValue } from '@/components/receipt/receipt.format';

export interface TransactionRowSubtitleProps {
  /** The category and date line. */
  subtitle: string;
  /** The counterparty address, when the row knows one. */
  address: string | null;
}

/**
 * The row's second and third lines: the category and date, then the counterparty
 * address when the row has one.
 *
 * The address is shown BESIDE the name it belongs to — name above, address
 * below — so a poisoned or mismatched merchant name is visible next to the real
 * address the money moved to. The name is a label; the address is the fact, and
 * it stays in monospace so two rows can be compared down a column.
 *
 * The full value stays in `title`: the abbreviation is for reading, never the
 * only copy of it.
 */
export function TransactionRowSubtitle({ subtitle, address }: TransactionRowSubtitleProps) {
  return (
    <>
      <Text variant="micro" as="span" className="block">
        {subtitle}
      </Text>
      {address ? (
        <span className="block font-mono text-body-sm text-stone" title={address}>
          {shortenValue(address)}
        </span>
      ) : null}
    </>
  );
}
