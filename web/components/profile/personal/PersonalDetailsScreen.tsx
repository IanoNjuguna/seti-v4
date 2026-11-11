'use client';

import { PageHeader } from '@/components/app/PageHeader';
import { Button, Text } from '@/components/ui';
import { ProfileRow } from '../ProfileRow';
import { PERSONAL_COPY } from './PersonalDetails.constants';
import { PersonalNameForm } from './PersonalNameForm';
import { usePersonalDetails } from './usePersonalDetails';

/**
 * The facts this account goes by, with exactly one of them writable.
 *
 * Reached from Settings on the profile page (#536). The shape is the one Wise and N26 use: a
 * list where each row carries its current value, and the reason a row is or is not editable
 * sits under its label rather than behind a tap.
 *
 * FOUR ROWS, and the order is the argument:
 *
 *   Your name    the one thing a person can change here, opened in place under its own row
 *   Seti name    signed, paid by, and IMMUTABLE, said in words rather than hidden
 *   Email        the sign-in identity, so not a field on a profile screen
 *   Phone        set by the number the sign-in provider verified
 *
 * The handle row has no chevron and never will: `ProfileRow` draws one only for a destination,
 * and the only destination a handle has is a new signature. That is a different decision from
 * this screen, and this screen says so instead of pretending the row is missing a button.
 */
export function PersonalDetailsScreen() {
  const details = usePersonalDetails();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={PERSONAL_COPY.title}
        href="/app/profile"
        label={PERSONAL_COPY.backLabel}
      />

      <div className="flex flex-col divide-y divide-hairline-light">
        <div className="pb-3">
          <ProfileRow
            title={PERSONAL_COPY.nameLabel}
            value={details.name}
            subtitle={PERSONAL_COPY.nameNote}
          >
            {details.editing ? null : (
              <Button variant="ghost" onClick={details.beginEdit}>
                {PERSONAL_COPY.nameAction}
              </Button>
            )}
          </ProfileRow>

          {/* The form is a SIBLING of the row, not a child: `ProfileRow` renders its children
              inside a `<span>`, and a `<form>` in a span is invalid HTML that browsers only
              tolerate. The divider between them is the list's own. */}
          {details.editing ? (
            <PersonalNameForm
              value={details.draft}
              saving={details.saving}
              error={details.error}
              onChange={details.changeDraft}
              onSave={details.save}
              onCancel={details.cancelEdit}
            />
          ) : null}
        </div>

        <ProfileRow
          title={PERSONAL_COPY.handleLabel}
          value={details.handle ? `@${details.handle}` : PERSONAL_COPY.handleNone}
          subtitle={PERSONAL_COPY.handleNote}
        />

        <ProfileRow
          title={PERSONAL_COPY.emailLabel}
          value={details.email ?? PERSONAL_COPY.emailNone}
          subtitle={PERSONAL_COPY.emailNote}
        />

        <ProfileRow
          title={PERSONAL_COPY.phoneLabel}
          value={details.phone ?? PERSONAL_COPY.phoneNone}
        />
      </div>

      {details.saved ? (
        <Text variant="micro" color="secondary" as="p" role="status">
          {PERSONAL_COPY.saved}
        </Text>
      ) : null}
    </div>
  );
}
