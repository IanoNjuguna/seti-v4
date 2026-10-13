'use client';

import { Button, Card, Text } from '@/components/ui';

export interface PaySuccessProps {
  txHash: string | null;
  onDone: () => void;
}

/**
 * Terminal success state.
 *
 * The hash is shown in full rather than truncated: on testnet it is the only way
 * to check the payment independently, and a customer who has just moved money is
 * entitled to the receipt. The explorer link comes later — it needs the chain
 * selected at build time, which is not plumbed into the web app yet.
 */
export function PaySuccess({ txHash, onDone }: PaySuccessProps) {
  return (
    <Card className="space-y-3 text-center">
      <Text variant="section" as="h2">
        Payment sent
      </Text>
      {txHash ? (
        <Text variant="micro" as="p" className="break-all">
          {txHash}
        </Text>
      ) : null}
      <Button className="mt-2" onClick={onDone}>
        Done
      </Button>
    </Card>
  );
}
