/**
 * Error shaping for MCP tool results.
 *
 * Why this file exists: provider libraries embed credentials in their error
 * text. viem puts the full request URL — RPC key included — into
 * `error.metaMessages` and the `URL:` line, and a Seti API error body could
 * echo an Authorization header. Tool output goes into a model's context and
 * then into a transcript, so an unscrubbed message is a leak with a long tail.
 * Every message handed back to a host goes through `scrub()` first.
 */

const REDACTED = '***';

/** Values that must never appear in tool output, longest first. */
function secrets(): string[] {
  return [
    process.env.SETI_API_TOKEN,
    process.env.TEMPO_MAINNET_RPC_URL,
    process.env.TEMPO_TESTNET_RPC_URL,
  ]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .sort((a, b) => b.length - a.length);
}

/**
 * Removes known secrets, and any credential-looking query parameter, from text.
 *
 * The key=/apiKey=/token= pass is a deliberate belt-and-braces measure: it
 * catches a provider URL we were not told about, where the secret is not in our
 * environment list but is still sitting in a query string.
 */
export function scrub(input: string): string {
  let out = input;
  for (const secret of secrets()) {
    out = out.split(secret).join(REDACTED);
  }
  out = out.replace(/([?&](?:key|api_key|apikey|token|access_token)=)[^&\s"']+/gi, `$1${REDACTED}`);
  return out;
}

export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolError';
  }
}

/** Normalises anything thrown into a scrubbed, single-line message. */
export function describeError(error: unknown): string {
  if (error instanceof ToolError) return scrub(error.message);

  const parts: string[] = [];
  if (error instanceof Error) {
    parts.push(error.message);
    // viem's shortMessage is the useful one; metaMessages carry the raw URL.
    const withDetail = error as Error & { shortMessage?: string; details?: string };
    if (withDetail.shortMessage && !error.message.includes(withDetail.shortMessage)) {
      parts.push(withDetail.shortMessage);
    }
    if (withDetail.details) parts.push(withDetail.details);
  } else if (typeof error === 'string') {
    parts.push(error);
  } else {
    try {
      parts.push(JSON.stringify(error));
    } catch {
      parts.push(String(error));
    }
  }
  return scrub(parts.filter(Boolean).join(' — ').replace(/\s+/g, ' ').trim());
}

/** The MCP result shape for a failure. */
export function toolError(error: unknown) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: `Error: ${describeError(error)}` }],
  };
}

/** The MCP result shape for a successful, text-bearing result. */
export function toolText(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

/** Renders a JSON payload for a tool result. */
export function toolJson(payload: unknown) {
  return toolText(JSON.stringify(payload, null, 2));
}
