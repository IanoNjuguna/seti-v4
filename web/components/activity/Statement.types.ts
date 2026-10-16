import type { StatementFormat } from '@/lib/api';

/** The hooks' and subcomponents' props, named once so they cannot drift. */

export interface StatementFormatsProps {
  /** The format being generated right now, or null. Drives spinner and disabling. */
  pending: StatementFormat | null;
  onDownload: (format: StatementFormat) => void;
}

export interface UseStatementDownloadReturn {
  /** The format being generated right now, or null when nothing is in flight. */
  pending: StatementFormat | null;
  /** Our sentence for a statement that did not arrive, or null. */
  error: string | null;
  /** Ask for one format. Ignored while another is already in flight. */
  download: (format: StatementFormat) => void;
  /** Ask again for the format that failed. */
  retry: () => void;
}
