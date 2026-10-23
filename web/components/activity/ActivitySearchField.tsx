'use client';

import { Icon } from '@/components/ui/Icon';
import { ACTIVITY_SEARCH_COPY, ACTIVITY_SEARCH_ID } from './ActivitySearch.constants';
import { ActivitySearchClear } from './ActivitySearchClear';
import type { ActivitySearchFieldProps } from './ActivitySearch.types';

/**
 * The search affordance above the bands: one field, a magnifier, and a way out.
 *
 * The contract is the `text-input` contract (`design/revolut.md`): 56px tall,
 * `rounded-md`, `surface-soft` as the well, and cobalt as the focus border, because
 * the system has no dedicated focus token and cobalt is its emphasis colour. It is
 * not `Input`: that primitive is a labelled form field with a hint and an error
 * slot, and this one carries a leading mark and a trailing control inside its own
 * well, which is a different object rather than a variant of it.
 *
 * The label is real and hidden, not a placeholder. A placeholder is not an
 * accessible name and it disappears the moment the field is used, which is exactly
 * when someone needs to be told what they are looking at.
 *
 * Keyboard and focus: `Escape` clears and leaves the caret in the field, the
 * convention a search field has on desktop, so the next query starts immediately.
 * There is no `<form>`, so Enter never reloads the page. Autocorrect and spellcheck
 * are off because names are not dictionary words, and a "corrected" merchant is a
 * merchant nobody can find. The match count is announced in a polite live region,
 * so a filtered list is never a silent list to a screen reader.
 */
export function ActivitySearchField({ search }: ActivitySearchFieldProps) {
  const { value, setValue, clear, inputRef, status } = search;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={ACTIVITY_SEARCH_ID} className="sr-only">
        {ACTIVITY_SEARCH_COPY.label}
      </label>

      <div className="relative">
        <Icon
          name="search"
          className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-mute"
        />

        <input
          ref={inputRef}
          id={ACTIVITY_SEARCH_ID}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && value) {
              event.preventDefault();
              clear();
            }
          }}
          placeholder={ACTIVITY_SEARCH_COPY.placeholder}
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          className="h-14 w-full rounded-md border border-hairline-light bg-surface-soft pr-14 pl-12 text-body-md text-ink outline-none transition-colors placeholder:text-ash focus:border-primary focus:ring-1 focus:ring-primary"
        />

        {value ? <ActivitySearchClear onClear={clear} /> : null}
      </div>

      <p role="status" className="sr-only">
        {status}
      </p>
    </div>
  );
}
