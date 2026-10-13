import { ScrollNavbar } from "./components/ScrollNavbar";
import { TreasuryAddress } from "./components/TreasuryAddress";

function ArrowUpRight({ className }: { className?: string }) {
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
    >
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col flex-1 bg-canvas-dark text-on-dark">
      <ScrollNavbar />

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section id="hero" className="relative min-h-screen border-b border-hairline-dark">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 h-full w-full object-cover opacity-60"
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260423_161253_c72b1869-400f-45ed-ac0c-52f68c2ed5bd.mp4"
          />
          <div className="pointer-events-none absolute inset-0 z-[5] bg-gradient-to-r from-canvas-dark/80 via-canvas-dark/50 to-transparent" />
          <div className="pointer-events-none absolute inset-0 z-[5] bg-gradient-to-t from-canvas-dark/70 via-transparent to-transparent" />
          <div className="relative z-10 flex min-h-screen flex-col justify-center px-6 pb-16 pt-24">
            <div className="mx-auto w-full max-w-6xl">
              <h1 className="max-w-3xl text-balance text-display-xl font-medium leading-none tracking-tight text-on-dark">
                a neo-bank
              </h1>
              <p className="mt-6 max-w-lg text-body-lg text-on-dark-mute">
                Scan a QR code. Spend your stable coins.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#download"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-canvas-light px-8 text-button font-semibold text-canvas-dark transition-all duration-200 hover:bg-faint active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-canvas-light/60 focus:ring-offset-2 focus:ring-offset-canvas-dark"
                >
                  Install
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <a
                  href="#solution"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-surface-elevated px-8 text-button font-semibold text-on-dark transition-all duration-200 hover:bg-surface-deep active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-on-dark/60 focus:ring-offset-2 focus:ring-offset-canvas-dark"
                >
                  See how it works
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Why seti.live */}
        <section id="why" className="bg-canvas-dark py-24 md:py-32">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-16 md:mb-20">
              <p className="text-caption font-mono font-semibold uppercase tracking-widest text-on-dark-mute">01 — Hello, World.</p>
              <h2 className="mt-2 max-w-2xl text-display-md font-medium leading-tight tracking-tight text-on-dark">
                An alternative to mobile money.
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {[
                ["01", "Currency debasement", "Inflation and currency volatility erode money held in KES denominated accounts over time."],
                ["02", "Global trade", "Receiving or sending money across countries takes days and high FX fees."],
              ].map(([num, title, desc]) => (
                <div key={num} className="rounded-lg bg-surface-elevated p-8 transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-deep">
                  <p className="text-display-sm font-mono font-medium text-on-dark-mute">{num}</p>
                  <p className="mt-4 text-heading-sm font-medium text-on-dark">{title}</p>
                  <p className="mt-2 text-body-md text-on-dark-mute">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Solution */}
        <section id="solution" className="bg-canvas-light py-24 md:py-32">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-16 md:mb-20">
              <p className="text-caption font-mono font-semibold uppercase tracking-widest text-mute">02 — How</p>
              <h2 className="mt-2 max-w-2xl text-display-md font-medium leading-tight tracking-tight text-ink">
                We use QR Codes
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                ["01", "Scan", "Scan a QR code."],
                ["02", "Spend", "OUSD and pathUSD, among others supported."],
                ["03", "Settlement", "Usually within seconds."],
              ].map(([num, title, desc]) => (
                <div key={num} className="rounded-lg border border-hairline-light bg-surface-card p-8 transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-soft">
                  <p className="text-display-sm font-mono font-medium text-stone">{num}</p>
                  <p className="mt-6 text-heading-sm font-medium text-ink">{title}</p>
                  <p className="mt-2 text-body-md text-body">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Partners */}
        <section id="partners" className="bg-canvas-light py-24 md:py-32">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-10 md:mb-12">
              <p className="text-caption font-mono font-semibold uppercase tracking-widest text-mute">03 — Rails</p>
              <h2 className="mt-2 max-w-2xl text-display-md font-medium leading-tight tracking-tight text-ink">
                Infrastructure & Partners
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-4">
              {[
                ["Tempo", "Payments", "Stablecoin-native EVM chain. Gas paid in OUSD and pathUSD.", "/tempo-wordmark.svg"],
                ["Stripe", "Fiat rails (planned)", "On-ramping and treasury infrastructure.", "/stripe-wordmark.svg"],
                ["Bridge", "Off-ramp (planned)", "Stablecoin-to-fiat infrastructure.", "/bridge-logo.svg"],
                ["Privy", "Wallets", "Authentication.", "/privy-stripe-company.png"],
              ].map(([name, role, desc, logo]) => (
                <div
                  key={name}
                  className="flex flex-col justify-between rounded-lg border border-hairline-light bg-surface-card p-8 transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-soft"
                >
                  <div>
                    {logo ? (
                      <img src={logo} alt={name} className={name === "Bridge" ? "h-10 w-auto" : "h-6 w-auto"} />
                    ) : (
                      <p className="text-xl font-medium text-ink">{name}</p>
                    )}
                    <p className="mt-3 text-caption font-mono font-semibold uppercase tracking-widest text-primary">{role}</p>
                  </div>
                  <p className="mt-8 text-body-md text-body">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Download */}
        <section id="download" className="bg-canvas-dark py-24 md:py-32">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid items-start gap-12 md:grid-cols-12">
              <div className="md:col-span-7">
                <p className="text-caption font-mono font-semibold uppercase tracking-widest text-on-dark-mute">04 — Download</p>
                <h2 className="mt-2 max-w-xl text-display-md font-medium leading-tight tracking-tight text-on-dark">
                  Get the app.
                </h2>
                <p className="mt-4 max-w-md text-body-lg text-on-dark-mute">
                  Install Seti and spend your stablecoins today.
                </p>
              </div>
              <div className="flex flex-col items-start gap-4 md:col-span-5 md:items-end md:justify-center">
                <a
                  href="#download"
                  aria-label="Install Seti for Android"
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-md bg-canvas-light px-8 text-button font-semibold text-canvas-dark transition-all duration-200 hover:bg-faint active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-canvas-light/60 focus:ring-offset-2 focus:ring-offset-canvas-dark"
                >
                  Install for Android
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <p className="text-body-sm font-medium text-on-dark-mute">
                  iOS coming soon.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-hairline-dark bg-canvas-dark">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <img src="/red-phoenix.png" alt="seti" className="h-10 w-auto" />
            <p className="text-body-sm text-on-dark-mute">
              © {new Date().getFullYear()} Seti. Made in Thika.
            </p>
            <div className="flex gap-6">
              <a href="/privacy" className="text-body-sm font-semibold text-on-dark-mute underline-offset-4 transition-colors hover:text-on-dark hover:underline focus:outline-none focus:ring-2 focus:ring-on-dark/60 focus:ring-offset-2 focus:ring-offset-canvas-dark">
                Privacy
              </a>
              <a href="/terms" className="text-body-sm font-semibold text-on-dark-mute underline-offset-4 transition-colors hover:text-on-dark hover:underline focus:outline-none focus:ring-2 focus:ring-on-dark/60 focus:ring-offset-2 focus:ring-offset-canvas-dark">
                Terms
              </a>
              <a href="/cookies" className="text-body-sm font-semibold text-on-dark-mute underline-offset-4 transition-colors hover:text-on-dark hover:underline focus:outline-none focus:ring-2 focus:ring-on-dark/60 focus:ring-offset-2 focus:ring-offset-canvas-dark">
                Cookies
              </a>
            </div>
          </div>
          <div className="mt-10 border-t border-hairline-dark pt-8">
            <TreasuryAddress />
          </div>
        </div>
      </footer>
    </div>
  );
}
