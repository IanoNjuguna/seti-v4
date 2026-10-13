import { Card, Text } from '@/components/ui';
import { PersonIdentity } from './PersonIdentity';
import { PersonSendAction } from './PersonSendAction';
import { PERSON_COPY } from './PersonPublic.constants';
import type { PersonPublicViewProps } from './PersonPublic.types';

/**
 * The whole public person view: identity, then the one action.
 *
 * Nothing about any customer is here — this page is a person's, opened by whoever
 * holds the link, and the only thing it needs to say is who is being sent to and
 * where the money goes.
 *
 * The send action is only offered when there is a handle to carry: without one,
 * there is no link to resolve, and a Send button that leads nowhere is worse than
 * none. It is the same shape as the business page — name, badge, address, one
 * action — with different words.
 */
export function PersonPublicView({ person }: PersonPublicViewProps) {
  return (
    <div className="space-y-6">
      <Text variant="micro" as="p" color="primary" className="font-brand text-heading-sm">
        {PERSON_COPY.brand}
      </Text>

      <Card className="space-y-6">
        <PersonIdentity person={person} />

        {person.handle ? <PersonSendAction handle={person.handle} /> : null}
      </Card>

      <Text variant="micro" as="p">
        {PERSON_COPY.moneyNote}
      </Text>
    </div>
  );
}
