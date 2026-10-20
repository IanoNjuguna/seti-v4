'use client';

import { useCallback, useId, useState } from 'react';

export interface UseAssetBreakdownReturn {
  open: boolean;
  toggle: () => void;
  /** The id the toggle controls, so a screen reader can follow it. */
  panelId: string;
}

/**
 * Open/closed state for the balance breakdown.
 *
 * Closed by default: the card's job is the figure, and a list of four tokens opened
 * underneath it on every visit would make the hero a table with a number on top.
 *
 * `useId` rather than a literal: the id has to be unique per page and identical
 * between the server render and the client one, which is exactly what it is for.
 */
export function useAssetBreakdown(): UseAssetBreakdownReturn {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggle = useCallback(() => setOpen((previous) => !previous), []);

  return { open, toggle, panelId };
}
