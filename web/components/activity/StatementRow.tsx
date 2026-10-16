'use client';

import { Button, StateMessage, Text } from '@/components/ui';
import { STATEMENT_COPY } from './Statement.constants';
import { StatementFormats } from './StatementFormats';
import { useStatementDownload } from './useStatementDownload';

/**
 * The statement row: one plain label, one line, and the three formats as its
 * content.
 *
 * It sits in the page's own row flow under the title, on the canvas rather than in
 * a card — the same call Profile's rows make (`border-t border-hairline-light
 * pt-6`) — so it reads as a row of Activity and not as a surface of its own. The
 * formats are buttons, this app's existing control, so no dropdown, sheet or
 * floating button had to be invented for them.
 *
 * A failure renders through the app's ONE failure primitive, `StateMessage`, with a
 * retry — the shape the list's own failed load takes — and its message is mapped
 * from the refusal code. A backend error on the statement therefore reads under its
 * own heading ("Could not make your statement") instead of the list's, without a
 * second error vocabulary being introduced.
 */
export function StatementRow() {
  const statement = useStatementDownload();

  return (
    <section className="border-t border-hairline-light pt-6">
      <Text variant="card-title" as="h2">
        {STATEMENT_COPY.title}
      </Text>
      <Text variant="micro" as="p" color="secondary" className="mt-1">
        {STATEMENT_COPY.intro}
      </Text>

      <div className="mt-4">
        <StatementFormats pending={statement.pending} onDownload={statement.download} />
      </div>

      {/* A live region rather than a toast: it is the answer to a press, so it
          belongs beside the control that was pressed, and the row does not move
          when it fills. */}
      <p aria-live="polite" className="mt-2 min-h-5 text-caption text-mute">
        {statement.pending ? STATEMENT_COPY.preparing : ''}
      </p>

      {statement.error ? (
        <div className="mt-4">
          <StateMessage
            variant="failure"
            title={STATEMENT_COPY.errorTitle}
            body={statement.error}
            action={<Button onClick={statement.retry}>{STATEMENT_COPY.retry}</Button>}
          />
        </div>
      ) : null}
    </section>
  );
}
