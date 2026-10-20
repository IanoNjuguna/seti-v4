import type { Metadata } from "next";
import localFont from "next/font/local";
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

export const metadata: Metadata = {
  title: "Seti — Get paid in dollars",
  description:
    'Your customer scans your code, types your name, or opens your link. No hidden charges. Made in Thika.',
  keywords: ["get paid", "dollar payments", "QR payments", "Kenya", "Thika", "Tempo", "OUSD", "pathUSD"],
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
