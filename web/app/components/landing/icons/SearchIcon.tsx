/** The palette's magnifier, and the one icon the nav draws itself. */
export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={className}
    >
      <circle cx="11" cy="11" r="7.5" />
      <path d="m20.5 20.5-4.8-4.8" />
    </svg>
  );
}
