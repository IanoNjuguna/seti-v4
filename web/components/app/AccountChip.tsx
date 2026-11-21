'use client';

/**
 * The account chip and its menu (#592).
 *
 * THE CHIP IS A CONTROL, NOT A WORD. The bar used to carry `@handle` as a plain link, which
 * reads as text and promises nothing. A chip with a chevron promises a menu, so it has to be
 * one: Profile, copy the pay link, sign out.
 *
 * TWO DENSITIES, AND THE BREAKPOINT IS A MEASUREMENT. Under 640px the chip is a 40px avatar
 * with no handle and no chevron: a handle there costs about 168px of a 360px bar and pushes
 * the bell and support controls under their 44px targets, which is the one thing the platform
 * guidance is unambiguous about. From 640px there is room for the handle (truncated at ~12
 * characters) and the chevron keeps its promise.
 *
 * THE MENU IS A POPOVER, NOT A NAVIGATION. Choosing Profile navigates; the other two act in
 * place. It closes on Escape, on a click outside, and after any choice, because a menu that
 * survives its own action looks like it did nothing.
 *
 * The display name never appears here. The handle is already public at `/u/<handle>`, and a
 * real name in the chrome of a money app is a disclosure nobody asked for.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { useSession } from '@/lib/auth';
import { PROFILE_PATH } from '@/lib/routes';
import { ACCOUNT_CHIP_COPY, COPY_FEEDBACK_MS, HANDLE_CLIP } from './AccountChip.constants';

/** The public page a person is paid at. Same origin, so a pasted link works anywhere. */
export function payLinkFor(handle: string, origin: string): string {
  return `${origin}/u/${handle}`;
}

function clipHandle(handle: string): string {
  return handle.length > HANDLE_CLIP ? `${handle.slice(0, HANDLE_CLIP - 1)}…` : handle;
}

export function AccountChip({ handle }: { handle: string | undefined }) {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onClick = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const copyPayLink = useCallback(async () => {
    if (!handle) return;
    try {
      await navigator.clipboard.writeText(payLinkFor(handle, window.location.origin));
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch {
      // A refused clipboard is not worth a dialog: the menu stays open and says nothing was
      // copied, which is the same state the customer can see for themselves.
      setCopied(false);
    }
  }, [handle]);

  const initials = (handle ?? 'you').slice(0, 2).toUpperCase();

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ACCOUNT_CHIP_COPY.openLabel}
        className="flex h-11 items-center gap-1.5 rounded-full pl-0.5 pr-1 transition-colors duration-(--duration-quick) ease-out hover:bg-surface-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark sm:gap-2 sm:pr-2.5"
      >
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-elevated font-brand text-micro font-semibold uppercase tracking-wide text-on-dark"
        >
          {initials}
        </span>
        {handle ? (
          <Text variant="tab" as="span" color="inverse" className="hidden max-w-[7.5rem] truncate sm:block">
            @{clipHandle(handle)}
          </Text>
        ) : null}
        <Icon name="chevronRight" className="hidden h-4 w-4 rotate-90 text-inverse-muted sm:block" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={ACCOUNT_CHIP_COPY.menuLabel}
          className="absolute right-0 top-[calc(100%+6px)] z-30 w-56 overflow-hidden rounded-md border border-hairline-dark bg-canvas-dark p-1 shadow-lg"
        >
          <Link
            href={PROFILE_PATH}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex h-11 items-center rounded-sm px-3 text-tab text-on-dark hover:bg-surface-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark"
          >
            {ACCOUNT_CHIP_COPY.profile}
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => void copyPayLink()}
            className="flex h-11 w-full items-center rounded-sm px-3 text-left text-tab text-on-dark hover:bg-surface-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark"
          >
            {copied ? ACCOUNT_CHIP_COPY.copied : ACCOUNT_CHIP_COPY.copyPayLink}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void session.signOut();
            }}
            className="flex h-11 w-full items-center rounded-sm px-3 text-left text-tab text-on-dark hover:bg-surface-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark"
          >
            {ACCOUNT_CHIP_COPY.signOut}
          </button>
        </div>
      ) : null}
    </div>
  );
}
