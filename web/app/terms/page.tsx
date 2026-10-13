import type { Metadata } from "next";
import { LegalDocument } from "../legal/LegalDocument";
import { termsContent } from "../legal/terms.content";

export const metadata: Metadata = {
  title: "Terms of Use — Seti",
  description:
    "The terms governing use of the Seti mobile app and website, including wallet custody, stablecoin payments, and dispute resolution.",
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
