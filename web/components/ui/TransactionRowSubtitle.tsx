import { Text } from './Text';

export interface TransactionRowSubtitleProps {
  /** The when line: date and time, or the date alone where the day already says it. */
  subtitle: string;
}

/**
 * The row's second line: when it happened.
 *
 * ## The address line is gone (#407)
 *
 * It used to sit under every row that knew one — name above, address below — on the argument that a
 * name is a label and the address is the fact. That argument is still true, and it is why the address
 * moved rather than vanished: it is on the receipt, which is the document someone checks a transfer
 * against. On the list it was the crypto tell: a column of monospace hex under a column of payments
 * is what makes a wallet feel like a developer tool, and the row is read by a person asking what they
 * spent at the shop on Tuesday.
 *
 * ## ONE LINE, AND IT TRUNCATES
 *
 * The content column is 104px at a 360px viewport, so this line elides. A date and a time elide at the
 * time (`5 Nov · 17…`) rather than at the date, which is the part a person is scanning for.
 */
export function TransactionRowSubtitle({ subtitle }: TransactionRowSubtitleProps) {
  return (
    <Text variant="micro" as="span" className="block truncate">
      {subtitle}
    </Text>
  );
}
