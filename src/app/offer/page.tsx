import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { getLegalDocument } from "@/lib/legal-documents";

const document = getLegalDocument("offer");

export const metadata: Metadata = {
  title: "Публичная оферта | eFootball Nexon",
  description: "Публичная оферта на оказание услуг по содействию в пополнении игровых аккаунтов на сайте eFootball Nexon.",
};

export default function OfferPage() {
  if (!document) notFound();

  return <LegalDocumentPage document={document} />;
}
