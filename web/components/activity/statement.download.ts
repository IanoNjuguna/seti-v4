/**
 * Hand a generated statement to the browser.
 *
 * The same recipe the receipt exports use: an object URL plus a synthetic anchor
 * click, revoked once the browser has started reading it. The file arrives as a
 * Blob because the request carried the session's header — a plain link could not
 * have — and the name is the one the server chose, so a saved statement is
 * identifiable later.
 */
export function saveStatement(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
