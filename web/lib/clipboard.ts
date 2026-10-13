/**
 * Copy text to the clipboard, with the legacy fallback.
 *
 * `navigator.clipboard` is unavailable or blocked in more situations than it is
 * allowed — non-HTTPS origins, denied permissions, some in-app webviews. When
 * every path fails the caller is TOLD rather than left believing the copy worked.
 *
 * One implementation, shared: the donations address and an account's own public
 * link are the same problem, and a second copy of this is how one of them
 * quietly loses the fallback.
 */
export async function writeToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path below.
    }
  }

  if (typeof document.execCommand !== 'function') return false;

  const scratch = document.createElement('textarea');
  scratch.value = text;
  scratch.setAttribute('readonly', '');
  scratch.style.position = 'fixed';
  scratch.style.opacity = '0';
  document.body.appendChild(scratch);
  scratch.select();

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(scratch);
  return ok;
}
