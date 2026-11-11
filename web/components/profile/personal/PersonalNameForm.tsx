'use client';

import { Button, Input } from '@/components/ui';
import { PERSONAL_COPY } from './PersonalDetails.constants';

export interface PersonalNameFormProps {
  value: string;
  saving: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * The name field, opened in place under its own row.
 *
 * In place rather than a modal, and that is the app's existing shape: the Save and Ask amount
 * steps replace the page's content, so a person changing one field gets the same movement they
 * already know from moving money. There is no sheet system to invent.
 *
 * A FORM, so Enter saves and the browser gets the primitive it expects; the Save button is the
 * submit, and Cancel is `type="button"` so it cannot submit by accident.
 */
export function PersonalNameForm({
  value,
  saving,
  error,
  onChange,
  onSave,
  onCancel,
}: PersonalNameFormProps) {
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <Input
        id="profile-name"
        label={PERSONAL_COPY.nameLabel}
        value={value}
        placeholder={PERSONAL_COPY.namePlaceholder}
        onChange={(event) => onChange(event.target.value)}
        error={error ?? undefined}
        autoComplete="name"
        autoFocus
      />

      <div className="flex flex-col gap-2 min-[380px]:flex-row">
        <Button type="submit" fullWidth loading={saving}>
          {saving ? PERSONAL_COPY.saving : PERSONAL_COPY.save}
        </Button>
        <Button type="button" variant="secondary" fullWidth onClick={onCancel} disabled={saving}>
          {PERSONAL_COPY.cancel}
        </Button>
      </div>
    </form>
  );
}
