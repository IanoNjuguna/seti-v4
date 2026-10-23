'use client';

import { Icon } from '@/components/ui/Icon';
import { ACTIVITY_SEARCH_COPY } from './ActivitySearch.constants';

export interface ActivitySearchClearProps {
  /** Empties the query and returns the caret to the field. */
  onClear: () => void;
}

/**
 * The field's clear control, inside its own well.
 *
 * 44px square, because a phone has to hit it and the glyph alone would be a 16px
 * target. It is a `button`, not the browser's native clear: the native one exists
 * only on some engines, cannot be styled, and disappears in the ones that do not
 * have it. `type="button"` because the field must never be part of a form that
 * submits; the label says what it clears, since a cross alone does not.
 */
export function ActivitySearchClear({ onClear }: ActivitySearchClearProps) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={ACTIVITY_SEARCH_COPY.clearField}
      className="absolute top-1/2 right-1 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-mute transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
    >
      <Icon name="close" className="h-4 w-4" />
    </button>
  );
}
