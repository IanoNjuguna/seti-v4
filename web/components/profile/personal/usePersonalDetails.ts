'use client';

import { useCallback, useState } from 'react';
import { updateAccountName } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useProfileIdentity } from '@/components/profile/useProfileIdentity';
import { PERSONAL_COPY } from './PersonalDetails.constants';
import type { UsePersonalDetailsReturn } from './PersonalDetails.types';

/**
 * The personal-information screen's facts and its one write.
 *
 * ## The facts come from the page that sent them here
 *
 * `useProfileIdentity` is the same hook the profile page uses, so the name this screen prints
 * and the name the page behind it prints cannot disagree — not while saving, not after. The
 * email and phone come from the session, which is where the app already keeps them.
 *
 * ## The write refreshes the session before it says it saved
 *
 * `updateAccountName` returns the updated record, but every other surface prints the SESSION's
 * copy, so the hook calls `refreshUser()` and only then flips to `saved`. A name that saves and
 * does not appear is the failure this ordering exists to prevent (#536).
 */
export function usePersonalDetails(): UsePersonalDetailsReturn {
  const person = useProfileIdentity();
  const session = useSession();
  const { refreshUser } = session;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const beginEdit = useCallback(() => {
    setDraft(person.name);
    setError(null);
    setSaved(false);
    setEditing(true);
  }, [person.name]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setError(null);
  }, []);

  const changeDraft = useCallback((value: string) => {
    setDraft(value);
    setError(null);
  }, []);

  const save = useCallback(() => {
    const name = draft.trim();

    if (!name) {
      setError(PERSONAL_COPY.nameRequired);
      return;
    }

    setSaving(true);
    setError(null);

    void updateAccountName(name)
      .then(() => refreshUser())
      .then(() => {
        setSaved(true);
        setEditing(false);
      })
      .catch(() => setError(PERSONAL_COPY.saveFailed))
      .finally(() => setSaving(false));
  }, [draft, refreshUser]);

  return {
    name: person.name,
    handle: person.handle,
    businesses: person.businesses,
    email: session.user?.email ?? null,
    phone: session.user?.phone ?? null,
    editing,
    draft,
    saving,
    error,
    saved,
    beginEdit,
    cancelEdit,
    changeDraft,
    save,
  };
}
