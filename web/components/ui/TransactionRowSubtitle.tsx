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
 * Both lines TRUNCATE rather than wrap. Measured at a 360px viewport the row's
 * content column is 104px wide (`-KES 1,250.00` and a 40px mark take the rest of
 * a 320px row), and an ellipsis at least reads as a deliberate cut: wrapping put
 * `Oct` alone on a second line and split the address mid-hash across two, which
 * made every row 125px tall and looked broken rather than dense. The address is
 * `caption` (13px) rather than `body-sm` so the WHOLE shortened value survives —
 * at 14px it was 0.3px too wide for the column and broke its own last four
 * characters onto a second line, which is the one part of an address a person
 * checks — and in `mute` rather than `stone`: 13px `stone` is 2.9:1 on white, and
 * this is the value a customer compares against the name above it, so it is a fact
 * to read rather than a caption to skim.
 *
 * The full value stays in `title`: the abbreviation is for reading, never the
 * only copy of it. On the Activity screen the day heading already carries the
 * date, so the elision costs nothing there; the receipt carries both in full.
 */
export function TransactionRowSubtitle({ subtitle, address }: TransactionRowSubtitleProps) {
  return (
    <>
      <Text variant="micro" as="span" className="block truncate">
        {subtitle}
      </Text>
      {address ? (
        <span
          className="block truncate font-mono text-caption text-mute"
          title={address}
        >
          {shortenValue(address)}
        </span>
      ) : null}
    </>
  );
}
