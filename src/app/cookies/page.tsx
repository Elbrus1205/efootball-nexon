import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { getLegalDocument } from "@/lib/legal-documents";

const document = getLegalDocument("cookies");

export const metadata: Metadata = {
  title: "Политика использования cookie",
  description: "Политика использования cookie сайта eFootball Nexon.",
};

export default function CookiesPage() {
  if (!document) notFound();

  return <LegalDocumentPage document={document} />;
}
