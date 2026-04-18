import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { getLegalDocument } from "@/lib/legal-documents";

const document = getLegalDocument("consent");

export const metadata: Metadata = {
  title: "Согласие на обработку персональных данных",
  description: "Согласие пользователя eFootball Nexon на обработку персональных данных.",
};

export default function ConsentPage() {
  if (!document) notFound();

  return <LegalDocumentPage document={document} />;
}
