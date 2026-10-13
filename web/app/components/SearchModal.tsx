"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const sections = [
  { id: "hero", label: "Home", keywords: "home hero spend stablecoins stablecoin" },
  { id: "why", label: "Why seti.live?", keywords: "why problem fees savings borders mobile money kenya" },
  { id: "solution", label: "How", keywords: "solution how scan qr spend stablecoins settle local currency" },
  { id: "partners", label: "Partners", keywords: "partners infrastructure tempo privy" },
  { id: "download", label: "Download", keywords: "download install android ios app" },
];

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

function CornerDownLeftIcon({ className }: { className?: string }) {
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
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
    </svg>
  );
}

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // State resets used to run in an effect, which React flags as a cascading
  // render. Remounting the panel on open resets it for free — and is what the
  // user actually sees, a freshly opened palette.
  if (!open) return null;
  return <SearchPanel key="panel" onClose={onClose} />;
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Track the previous query during render (the React-recommended alternative
  // to resetting state in an effect) so arrow-key selection restarts at the
  // top whenever the result set changes.
  const [lastQuery, setLastQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  if (query !== lastQuery) {
    setLastQuery(query);
    setSelectedIndex(0);
  }
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sections;
    return sections.filter(
      (section) =>
        section.label.toLowerCase().includes(normalized) ||
        section.keywords.toLowerCase().includes(normalized)
    );
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = results[selectedIndex];
        if (selected) {
          const element = document.getElementById(selected.id);
          if (selected.id === "hero") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else if (element) {
            element.scrollIntoView({ behavior: "smooth" });
          }
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, results, selectedIndex]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-canvas-dark/60 px-4 pt-32 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-hairline-dark bg-surface-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-hairline-dark px-4 py-3">
          <SearchIcon className="h-5 w-5 text-on-dark-mute" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sections..."
            className="flex-1 bg-transparent text-body-md text-on-dark placeholder:text-on-dark-mute focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/60"
          />
          <span className="rounded bg-surface-deep px-1.5 py-0.5 text-[10px] font-semibold text-on-dark-mute">
            ESC
          </span>
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-body-md text-on-dark-mute">
              No results found.
            </p>
          ) : (
            results.map((section, index) => (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  if (section.id === "hero") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  } else {
                    document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth" });
                  }
                  onClose();
                }}
                className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/60 ${
                  index === selectedIndex
                    ? "bg-canvas-dark text-on-dark"
                    : "text-on-dark-mute hover:bg-surface-deep hover:text-on-dark"
                }`}
              >
                <span className="text-body-md font-semibold">{section.label}</span>
                {index === selectedIndex && <CornerDownLeftIcon className="h-4 w-4" />}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-hairline-dark px-4 py-2 text-caption text-on-dark-mute">
          <span>Use arrow keys to navigate</span>
          <span>Enter to select</span>
        </div>
      </div>
    </div>
  );
}
