import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { getLegalDocument } from "@/lib/legal-documents";

const document = getLegalDocument("terms");

export const metadata: Metadata = {
  title: "Пользовательское соглашение",
  description: "Пользовательское соглашение сайта eFootball Nexon.",
};

export default function TermsPage() {
  if (!document) notFound();

  return <LegalDocumentPage document={document} />;
}
