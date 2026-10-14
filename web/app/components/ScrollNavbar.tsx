"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SearchModal } from "./SearchModal";

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function CommandIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
    </svg>
  );
}

export function ScrollNavbar() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-50 px-6 py-4">
        <nav className="relative mx-auto flex h-16 max-w-5xl items-center justify-between rounded-md border border-hairline-dark bg-canvas-dark/50 px-4 backdrop-blur-lg">
          <a href="#hero" className="flex items-center">
            <img src="/red-phoenix-mark.png" alt="Seti" className="h-10 w-auto" />
          </a>

          <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-8 md:flex">
            <a href="#why" className="rounded-sm text-body-sm font-semibold text-on-dark-mute transition-colors hover:text-on-dark focus:outline-none focus:ring-2 focus:ring-on-dark/60 focus:ring-offset-2 focus:ring-offset-canvas-dark">
              Why
            </a>
            <a href="#solution" className="rounded-sm text-body-sm font-semibold text-on-dark-mute transition-colors hover:text-on-dark focus:outline-none focus:ring-2 focus:ring-on-dark/60 focus:ring-offset-2 focus:ring-offset-canvas-dark">
              How
            </a>
            <a href="#partners" className="rounded-sm text-body-sm font-semibold text-on-dark-mute transition-colors hover:text-on-dark focus:outline-none focus:ring-2 focus:ring-on-dark/60 focus:ring-offset-2 focus:ring-offset-canvas-dark">
              Partners
            </a>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-9 items-center justify-between gap-2 rounded-md bg-surface-deep px-3 text-body-sm text-on-dark-mute transition-all duration-200 hover:text-on-dark active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-on-dark/60 focus:ring-offset-2 focus:ring-offset-canvas-dark"
            >
              <span className="flex items-center gap-2">
                <SearchIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Search</span>
              </span>
              <span className="hidden items-center gap-0.5 rounded-sm bg-surface-elevated px-1.5 py-0.5 text-[10px] font-semibold text-on-dark-mute sm:flex">
                <CommandIcon className="h-3 w-3" />
                <span>K</span>
              </span>
            </button>

            {/*
             * The product app's only entry point. Without this the web app is
             * reachable only by typing `/app` — nothing on the site linked to it.
             * `button-primary` from the design system (white pill on the dark
             * canvas, height 48px in a 64px nav-bar). Lands on the sign-in card
             * when signed out.
             */}
            <Link
              href="/app"
              className="inline-flex h-12 shrink-0 items-center rounded-md bg-canvas-light px-7 text-button font-semibold text-canvas-dark transition-opacity duration-200 hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-on-dark/60 focus:ring-offset-2 focus:ring-offset-canvas-dark"
            >
              Log in
            </Link>
          </div>
        </nav>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
