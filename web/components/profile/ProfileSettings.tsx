import { Text } from '@/components/ui';
import { CHAIN_NAME } from '@/lib/chain';
import { ProfileLegalRows } from './ProfileLegalRows';
import { ProfileModeRow } from './ProfileModeRow';
import { PROFILE_PAGE_COPY } from './ProfilePage.constants';
import { ProfileRow } from './ProfileRow';
import type { ProfileSettingsProps } from './ProfileSettings.types';

/**
 * The settings, as dense rows under one heading.
 *
 * No cards, and no row that is a card in disguise: a title, the fact it carries,
 * and one hairline between rows (`divide-y`), which is the whole separation this
 * system has for a list. Cards here would say each row is a separate thing to deal
 * with, and these are four facts about one account.
 *
 * The mode row is the only writable one and it keeps its switch. The businesses
 * below it are LISTED, one row each: the account carries `intent` (personal or
 * business), not a selected business, so there is no "active" one to mark and
 * nothing here pretends otherwise. A chooser would have to invent that state, and
 * marking one row as current would be a claim the server cannot make yet.
 *
 * `Network` states the chain the account acts on and nothing else. The
 * Practice/Live switch is gone, with its readiness sentence: this deployment serves
 * one network, and the deposit address is Receive's to hold.
 */
export function ProfileSettings({ name, handle, businesses }: ProfileSettingsProps) {
  return (
    <section className="flex flex-col gap-3">
      <Text variant="heading-md" as="h2">
        {PROFILE_PAGE_COPY.settingsHeading}
      </Text>

      <div className="flex flex-col divide-y divide-hairline-light">
        <ProfileRow
          title={PROFILE_PAGE_COPY.personalTitle}
          value={name}
          subtitle={handle ? `@${handle}` : undefined}
        />

        <ProfileModeRow />

        {businesses.map((business) => (
          <ProfileRow key={business.id} title={business.name} subtitle={`@${business.handle}`} />
        ))}

        <ProfileRow title={PROFILE_PAGE_COPY.networkTitle} value={CHAIN_NAME} />

        <ProfileLegalRows />
      </div>
    </section>
  );
}
