import { Badge, Text } from '@/components/ui';
import { shortenValue } from '@/components/receipt/receipt.format';
import { merchantVerification } from '@/lib/api/merchant-verification';
import { PERSON_COPY } from './PersonPublic.constants';
import type { PersonIdentityProps } from './PersonPublic.types';

/**
 * Who the customer is about to send to: the name, its verification state, and the
 * address underneath.
 *
 * The address is the authoritative thing and the name is only a label, so they
 * appear together and in that order — the shortened form for reading, the FULL
 * address in `title` so a suspicious person can check every character. The
 * verification badge is drawn only from the flag the server sent (`verified`,
 * recomputed from the stored signature); a missing flag shows nothing, because an
 * absent answer is not a "yes".
 *
 * It reads "Send money / Ian" — a person, not a shop. There is no till here.
 */
export function PersonIdentity({ person }: PersonIdentityProps) {
  const verification = merchantVerification(person);

  return (
    <div>
      <Text variant="micro" as="p">
        {PERSON_COPY.eyebrow}
      </Text>

      <Text variant="section" as="h1" className="mt-1">
        {person.name}
      </Text>

      {person.address ? (
        <p className="mt-2 font-mono text-body-sm text-stone" title={person.address}>
          {shortenValue(person.address)}
        </p>
      ) : (
        <Text variant="micro" as="p" className="mt-2">
          {PERSON_COPY.noAddress}
        </Text>
      )}

      {verification === null ? null : (
        <div className="mt-3">
          <Badge variant={verification ? 'success' : 'warning'}>
            {verification ? PERSON_COPY.verified : PERSON_COPY.unverified}
          </Badge>
        </div>
      )}
    </div>
  );
}
