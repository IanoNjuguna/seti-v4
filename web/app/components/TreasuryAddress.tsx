"use client";

import { useState } from "react";

/**
 * Donations block for the footer.
 *
 * The address is the same `SETI_TREASURY_ADDRESS` the backend validates at boot
 * (backend/src/config/env.ts). The QR image is generated from that value by
 * web/scripts/generate-treasury-qr.py — regenerate it if the address changes,
 * otherwise the two drift and the QR silently points somewhere else.
 *
 * Deliberately not a payment counterparty: this is a donations address. The
 * product is non-custodial with no fiat off-ramp, so nothing here should read
 * as "we'll pay you out".
 */
const TREASURY_ADDRESS = "0x48cb25f9d82aF721e71437feAfb295da627BA475";

// EIP-55 mixed case is the checksum form. It is shown in full, never truncated:
// a donation address that a human cannot fully compare against their wallet is
// an address people send the wrong number to.
type CopyState = "idle" | "copied" | "failed";

function CopyIcon({ className }: { className?: string }) {
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
      aria-hidden="true"
    >
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * Clipboard write with a legacy fallback.
 *
 * `navigator.clipboard` is unavailable or blocked in more situations than it is
 * allowed — non-HTTPS origins, denied permissions, some in-app webviews. When
 * every path fails the caller says so rather than pretending the copy worked.
 */
async function writeToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path below.
    }
  }

  if (typeof document.execCommand !== "function") return false;

  const scratch = document.createElement("textarea");
  scratch.value = text;
  scratch.setAttribute("readonly", "");
  scratch.style.position = "fixed";
  scratch.style.opacity = "0";
  document.body.appendChild(scratch);
  scratch.select();

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(scratch);
  return ok;
}

export function TreasuryAddress() {
  const [state, setState] = useState<CopyState>("idle");

  async function copy() {
    const ok = await writeToClipboard(TREASURY_ADDRESS);
    setState(ok ? "copied" : "failed");
    if (ok) setTimeout(() => setState("idle"), 2000);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption font-mono font-semibold uppercase tracking-widest text-on-dark-mute">
        Donations
      </p>
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/treasury-qr.png"
          alt={`QR code for the Seti donations address ${TREASURY_ADDRESS}`}
          className="h-16 w-16 shrink-0 rounded-md bg-canvas-light p-1"
        />
        <div className="flex flex-col gap-2">
          <p className="text-body-sm text-on-dark-mute">
            Send to this address.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="select-all break-all font-mono text-body-sm text-on-dark">
              {TREASURY_ADDRESS}
            </code>
            <button
              type="button"
              onClick={copy}
              aria-label={
                state === "copied"
                  ? "Donations address copied"
                  : `Copy donations address ${TREASURY_ADDRESS}`
              }
              className="flex h-8 w-8 items-center justify-center rounded-sm border border-hairline-dark text-on-dark-mute transition-colors hover:text-on-dark focus:outline-none focus:ring-2 focus:ring-on-dark/60 focus:ring-offset-2 focus:ring-offset-canvas-dark"
            >
              {state === "copied" ? (
                <CheckIcon className="h-4 w-4 text-accent-green-text" />
              ) : (
                <CopyIcon className="h-4 w-4" />
              )}
            </button>
          </div>
          {state === "failed" && (
            <p className="text-body-sm text-on-dark-mute">
              Copy blocked by the browser. Select the address above to copy it.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}