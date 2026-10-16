import { getFile } from './client';
import {
  STATEMENT_FILE_PREFIX,
  STATEMENT_FORMAT_PARAM,
  STATEMENT_PATH,
} from './statement.constants';

/** The three formats the statement endpoint writes. */
export type StatementFormat = 'csv' | 'xlsx' | 'pdf';

/** A generated statement, ready to hand to the browser. */
export interface StatementFile {
  blob: Blob;
  /** The server's own filename when it named one, otherwise ours. */
  fileName: string;
}

/**
 * Ask the backend for this account's statement in one format.
 *
 * The session travels in the request's `Authorization` header, so the response is
 * a file the caller has to hand to the browser itself rather than a URL the
 * browser can open. A refusal is mapped to our copy by `getFile`, so a statement
 * that fails reads the same way any other refused read does.
 */
export async function fetchStatement(format: StatementFormat): Promise<StatementFile> {
  const file = await getFile(`${STATEMENT_PATH}?${STATEMENT_FORMAT_PARAM}=${format}`);

  return {
    blob: file.blob,
    fileName: file.fileName ?? `${STATEMENT_FILE_PREFIX}.${format}`,
  };
}
