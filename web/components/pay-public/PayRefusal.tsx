import Link from 'next/link';
import { Card, Text } from '@/components/ui';
import { PAY_COPY, PAY_LINK_CLASS } from './PayPublic.constants';

/**
 * The refusal: a request whose signature does not hold.
 *
 * It draws NO amount, NO recipient and NO code. That is the point of the state rather
 * than a detail of it — a forged charge is usually a real-looking one with one field
 * changed, so rendering any of it "for context" is how a payer is talked into paying
 * an address that was never signed. There is nothing here to act on and nothing to tap
 * by mistake.
 *
 * The wording is one sentence of fact, one of consequence, one of what to do. It does
 * not say WHY the signature failed: an attacker learns which half to fix, and a payer
 * learns nothing they can use. A page that said "expired or tampered with" would be the
 * "half-truth" the issue forbids.
 */
export function PayRefusal() {
  return (
    <Card className="space-y-3">
      <Text variant="section" as="h1">
        {PAY_COPY.refusedTitle}
      </Text>

      <Text variant="body" color="secondary" as="p">
        {PAY_COPY.refusedBody}
      </Text>

      <Text variant="micro" as="p">
        {PAY_COPY.refusedNext}
      </Text>

      <Link href="/app" className={PAY_LINK_CLASS}>
        {PAY_COPY.goToApp}
      </Link>
    </Card>
  );
}
