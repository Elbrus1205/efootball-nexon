import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { crossBorderDocument } from "@/lib/cross-border-document";

export const metadata: Metadata = { title: crossBorderDocument.title, description: crossBorderDocument.description };

export default function CrossBorderTransferPage() {
  return <LegalDocumentPage document={crossBorderDocument} />;
}
