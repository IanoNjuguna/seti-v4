import Link from "next/link";

export interface LegalSection {
  /** Numbered clause title, e.g. "3. Privacy". */
  title: string;
  /** Plain-text paragraphs. `**bold**` and `*italic*` are honoured. */
  paragraphs: string[];
  /** Optional nested bullet clauses rendered as a sub-list. */
  clauses?: string[];
}

/**
 * Renders one top-level section. Inline `**bold**` markers are converted to
 * <strong>. Kept deliberately small: the legal body is data, not markup, so the
 * documents stay reviewable as plain text.
 */
function Section({ section }: { section: LegalSection }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-heading-sm font-medium text-on-dark">{section.title}</h2>
      {section.paragraphs.map((paragraph) => (
        <p
          key={paragraph.slice(0, 48)}
          className="mt-4 text-body-md leading-relaxed text-on-dark-mute"
        >
          {paragraph}
        </p>
      ))}
      {section.clauses ? (
        <ol className="mt-4 space-y-3">
          {section.clauses.map((clause, index) => (
            <li
              key={clause.slice(0, 48)}
              className="flex gap-3 text-body-md leading-relaxed text-on-dark-mute"
            >
              <span className="font-mono text-on-dark-mute">
                {index + 1}.
              </span>
              <span>{clause}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

export function LegalDocument({
  title,
  effectiveDate,
  intro,
  sections,
  footnote,
}: {
  title: string;
  effectiveDate: string;
  intro: string[];
  sections: LegalSection[];
  footnote: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas-dark text-on-dark">
      <header className="border-b border-hairline-dark">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-6">
          <Link
            href="/"
            className="flex items-center focus:outline-none focus:ring-2 focus:ring-on-dark/60 focus:ring-offset-2 focus:ring-offset-canvas-dark"
          >
            <img src="/red-phoenix-mark.png" alt="Seti" className="h-9 w-auto" />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 md:py-24">
        <h1 className="text-display-md font-medium tracking-tight text-on-dark">
          {title}
        </h1>
        <p className="mt-3 text-body-sm font-mono uppercase tracking-widest text-on-dark-mute">
          Effective {effectiveDate}
        </p>

        <div className="mt-12 space-y-6">
          {intro.map((paragraph) => (
            <p
              key={paragraph.slice(0, 48)}
              className="text-body-md leading-relaxed text-on-dark-mute"
            >
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-16 space-y-10">
          {sections.map((section) => (
            <Section key={section.title} section={section} />
          ))}
        </div>
      </main>

      <footer className="border-t border-hairline-dark">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <p className="max-w-2xl text-caption leading-relaxed text-on-dark-mute">
            {footnote}
          </p>
          <div className="mt-6 flex gap-6">
            <Link
              href="/privacy"
              className="text-body-sm font-semibold text-on-dark-mute underline-offset-4 transition-colors hover:text-on-dark hover:underline"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-body-sm font-semibold text-on-dark-mute underline-offset-4 transition-colors hover:text-on-dark hover:underline"
            >
              Terms
            </Link>
            <Link
              href="/cookies"
              className="text-body-sm font-semibold text-on-dark-mute underline-offset-4 transition-colors hover:text-on-dark hover:underline"
            >
              Cookies
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
