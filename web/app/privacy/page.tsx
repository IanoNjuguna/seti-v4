import type { Metadata } from "next";
import { LegalDocument } from "../legal/LegalDocument";
import { privacyContent } from "../legal/privacy.content";

export const metadata: Metadata = {
  title: "Privacy Policy — Seti",
  description:
    "What personal information Seti collects, why, who we share it with, and the rights you have under the Kenya Data Protection Act.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      title={privacyContent.title}
      effectiveDate={privacyContent.effectiveDate}
      intro={privacyContent.intro}
      sections={privacyContent.sections}
      footnote={privacyContent.footnote}
    />
  );
}
