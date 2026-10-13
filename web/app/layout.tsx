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
  title: "Seti — A Neo-Bank",
  description:
    "Scan any merchant QR code in Kenya and spend your stablecoins. Seti settles instantly in USD stablecoins on Tempo.",
  keywords: ["stablecoin payments", "QR code payments", "Kenya", "Nairobi", "Tempo", "USDC", "OUSD", "mobile money"],
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
