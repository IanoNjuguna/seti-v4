'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Whether the money on screen is hidden, for the SESSION.
 *
 * Mounted once in `web/app/(product)/app/layout.tsx`, so the flag survives client-side
 * navigation between `/app` routes and resets on a reload. Nothing is written to
 * storage: the privacy notice states that no such preference is stored, and reading
 * one during render would differ between the server's markup and the client's.
 *
 * It lives above the screen because the previous control did not: a flag held inside
 * `BalanceFigure` un-hid itself the moment the customer tapped Pay and came back,
 * which is a leak rather than a quirk.
 */
export interface AmountPrivacy {
  hidden: boolean;
  toggle: () => void;
}

const AmountPrivacyContext = createContext<AmountPrivacy | null>(null);

export interface AmountPrivacyProviderProps {
  children: ReactNode;
  /**
   * Where the flag starts. `false` for the running app — a customer's amounts are
   * visible until they clear them — and only ever set when rendering a state that is
   * not the default (a preview or a test), because the flag itself is not stored.
   */
  initialHidden?: boolean;
}

export function AmountPrivacyProvider({ children, initialHidden = false }: AmountPrivacyProviderProps) {
  const [hidden, setHidden] = useState(initialHidden);
  const toggle = useCallback(() => setHidden((previous) => !previous), []);
  const value = useMemo(() => ({ hidden, toggle }), [hidden, toggle]);

  return <AmountPrivacyContext.Provider value={value}>{children}</AmountPrivacyContext.Provider>;
}

/**
 * The flag, and the one place it can be flipped.
 *
 * Throws outside the provider rather than defaulting to "visible": a money figure
 * that renders because nobody mounted the provider is exactly the defect this exists
 * to prevent, and a silent default would hide it.
 */
export function useAmountPrivacy(): AmountPrivacy {
  const value = useContext(AmountPrivacyContext);

  if (!value) {
    throw new Error('useAmountPrivacy must be used inside AmountPrivacyProvider');
  }

  return value;
}
