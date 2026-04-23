import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { getLegalDocument } from "@/lib/legal-documents";

const document = getLegalDocument("offer");

export const metadata: Metadata = {
  title: "Публичная оферта | eFootball Nexon",
  description:
    "Публичная оферта eFootball Nexon об оказании информационно-технических услуг по обработке заявок, сопровождению заказов и помощи в оформлении цифровых услуг в интересах клиента.",
};

export default function OfferPage() {
  if (!document) notFound();

  return <LegalDocumentPage document={document} />;
}
