import type { Metadata } from "next";
import localFont from "next/font/local";
import { SITE_ORIGIN } from "@/lib/site";
import { siteSchemas } from "@/lib/structured-data";
import "./globals.css";

/**
 * The three faces, all served from this repository.
 *
 * They used to come from `next/font/google`, which self-hosts at RUNTIME but
 * fetches at BUILD time: every build read `fonts.gstatic.com`, so a build with
 * no route to Google either failed or fell back without saying so, and the exact
 * bytes that shipped were not in the diff. The files live in `./fonts` now (see
 * that directory's README for provenance and licences).
 *
 * Poppins carries body text, headings and the wordmark. JetBrains Mono carries
 * figures, addresses and hashes — including the balance hero, whose variants
 * name the mono family rather than the brand one. JetBrains Mono is a variable
 * font, so one file serves 400 through 800; Poppins is static, hence four.
 */
const poppins = localFont({
  src: [
    { path: "./fonts/poppins-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-poppins",
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-var.woff2",
  weight: "400 800",
  style: "normal",
  display: "swap",
  variable: "--font-jetbrains",
});

/**
 * The two strings every surface repeats: the tab, a search result, a shared
 * link preview. They are written to be read cold, out of context, by someone
 * who has never heard of Seti, so the title says the job (getting paid, in
 * dollars, by QR code, in Kenya) and the description says how the money moves
 * and what it costs, including the city the company is run from.
 */
export const metadata: Metadata = {
  /* Absolute URLs are built from SITE_ORIGIN below, so this changes no output
     today. It is set anyway because it is the one place that decides what an
     absolute-looking path resolves against, and Next fails the BUILD when a
     URL field has no base. Better a build error now than a link preview that
     points at a preview host. */
  metadataBase: new URL(SITE_ORIGIN),
  title: "Get paid in dollars by QR code in Kenya · Seti",
  description:
    "A customer scans the code on your counter or types your name, and the dollars land in your own wallet. One flat fee, no monthly fee. Made in Thika.",
  keywords: ["get paid", "dollar payments", "QR payments", "Kenya", "Thika", "Tempo", "OUSD", "pathUSD"],
  /* The preview card restates the title and description rather than inventing
     a shorter variant: a link that says something different from the page it
     opens reads as a bait, and there is nothing here worth saying twice in two
     ways. `locale` is en_KE, not en_US, because the price on the page is a
     Kenyan price and the audience is Kenyan. */
  openGraph: {
    title: "Get paid in dollars by QR code in Kenya · Seti",
    description:
      "A customer scans the code on your counter or types your name, and the dollars land in your own wallet. One flat fee, no monthly fee. Made in Thika.",
    url: SITE_ORIGIN,
    siteName: "Seti",
    locale: "en_KE",
    type: "website",
    images: [`${SITE_ORIGIN}/seti-lockup.png`],
  },
  /* The large card shows the lockup at the width it was drawn for; the summary
     card would crop it into a thumbnail. */
  twitter: {
    card: "summary_large_image",
    title: "Get paid in dollars by QR code in Kenya · Seti",
    description:
      "A customer scans the code on your counter or types your name, and the dollars land in your own wallet. One flat fee, no monthly fee. Made in Thika.",
  },
  /* The tab: the mark on its own, no tile. The tab is chrome the mark does not
     own, and it is the one place the alien is all a visitor sees, so a black
     square there reads as a thumbnail of the product instead of as its face.
     One colourway for every browser scheme rather than a `prefers-color-scheme`
     pair: the tab has to be the same object on every machine, and cream was no
     more legible than white is on a light bar. The .ico stays for clients that
     only ever ask for /favicon.ico. */
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/favicon.png", sizes: "64x64", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${poppins.variable} ${jetbrainsMono.variable} h-full font-sans antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Structured data belongs in the server HTML, not appended after
            hydration: a crawler or an assistant reading the document without
            running scripts has to find the entity in the bytes we ship.
            dangerouslySetInnerHTML is safe here because the payload is a
            constant assembled at module load from SITE_ORIGIN, never user
            input, so there is nothing in it to escape. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({ "@context": "https://schema.org", "@graph": siteSchemas }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
