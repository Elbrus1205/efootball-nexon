import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { getLegalDocument } from "@/lib/legal-documents";

const document = getLegalDocument("privacy");

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: "Политика обработки персональных данных и конфиденциальности eFootball Nexon.",
};

export default function PrivacyPage() {
  if (!document) notFound();

  return <LegalDocumentPage document={document} />;
}
