import type { Metadata } from "next";
import { LegalDocument } from "../legal/LegalDocument";
import { termsContent } from "../legal/terms.content";

export const metadata: Metadata = {
  title: "Terms of Use — Seti",
  description:
    "The terms for using Seti: what it is, how a payment works, the 2% fee, what is recorded, and what is public.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalDocument
      title={termsContent.title}
      effectiveDate={termsContent.effectiveDate}
      intro={termsContent.intro}
      sections={termsContent.sections}
      footnote={termsContent.footnote}
    />
  );
}
