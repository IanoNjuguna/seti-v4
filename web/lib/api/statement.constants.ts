/**
 * The statement endpoint, pinned with the backend.
 *
 * One route, one query parameter, three extensions. It is authenticated with the
 * same session as every other read, which is why the client reaches it through
 * `getFile` and not through a link: a URL the browser opens itself carries no
 * `Authorization` header.
 */
export const STATEMENT_PATH = '/transactions/statement';

/** The query parameter the format is named in. */
export const STATEMENT_FORMAT_PARAM = 'format';

/**
 * Our fallback filename, used only when the server sends no `Content-Disposition`.
 *
 * The server names the file itself (`seti-statement-<from>-<to>.<ext>`); this is
 * the name a request without that header still gets, so the download is never
 * left called "download".
 */
export const STATEMENT_FILE_PREFIX = 'seti-statement';
