import type { Metadata } from "next";
import { LegalDocument } from "../legal/LegalDocument";
import { cookiesContent } from "../legal/cookies.content";

export const metadata: Metadata = {
  title: "Cookie Notice — Seti",
  description:
    "What cookies and similar technologies Seti uses. We use no advertising, analytics, or tracking cookies.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalDocument
      title={cookiesContent.title}
      effectiveDate={cookiesContent.effectiveDate}
      intro={cookiesContent.intro}
      sections={cookiesContent.sections}
      footnote={cookiesContent.footnote}
    />
  );
}
