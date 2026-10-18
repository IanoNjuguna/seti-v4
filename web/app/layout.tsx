import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
  weight: ["400", "500", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
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
    <html lang="en" className={`${plusJakartaSans.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} h-full font-sans antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
