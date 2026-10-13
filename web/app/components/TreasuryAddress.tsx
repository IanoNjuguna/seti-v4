"use client";

import { useState } from "react";
import { writeToClipboard } from "@/lib/clipboard";

/**
 * Seti's treasury address, in the footer.
 *
 * This is the address the backend collects the 2% platform fee to
 * (`SETI_TREASURY_ADDRESS`, validated at boot in backend/src/config/env.ts). The
 * address is published as a TRANSPARENCY item — where the fee goes is checkable
 * on chain — and deliberately not as somewhere to send money.
 *
 * It used to read "Donations / Send to this address." beside a QR code, which on
 * a marketing page reads as a request for funds. Two things were wrong with
 * that: the label did not say what the address IS (it is Seti's own fee wallet,
 * not a general receiving address), and the imperative plus a scan-to-pay code
 * turned a disclosure into a solicitation — a customer who acted on it would
 * have sent an irreversible transfer to the treasury with no refund path. So
 * there is no imperative and no QR here: the block states what the address is
 * and offers the address itself to copy. The QR generator
 * (web/scripts/generate-treasury-qr.py) stays; it is worth running only if this
 * address is ever published somewhere scanning it is the point.
 *
 * Deliberately not a payment counterparty either: the product is non-custodial
 * with no fiat off-ramp, so nothing here should read as "we'll pay you out".
 */
const TREASURY_ADDRESS = "0x48cb25f9d82aF721e71437feAfb295da627BA475";

// EIP-55 mixed case is the checksum form. It is shown in full, never truncated:
// an address a human cannot fully compare against their wallet is an address
// people send the wrong number to.
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
        Treasury
      </p>
      <div className="flex flex-col gap-2">
        <p className="max-w-md text-body-sm text-on-dark-mute">
          Where Seti&rsquo;s 2% platform fee is collected. It is Seti&rsquo;s own fee wallet
          &mdash; not a payout address, and not somewhere to send a payment.
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
                ? "Treasury address copied"
                : `Copy treasury address ${TREASURY_ADDRESS}`
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
  );
}
