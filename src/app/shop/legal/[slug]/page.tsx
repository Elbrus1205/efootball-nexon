import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, FileCheck2, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { getShopLegalDocument, SHOP_LEGAL_VERSION, SHOP_SUPPORT_EMAIL, SHOP_SUPPORT_TELEGRAM, shopLegalDocuments } from "@/lib/shop/legal";
import styles from "@/components/shop/shop.module.css";

export function generateStaticParams() {
  return shopLegalDocuments.map(({ slug }) => ({ slug }));
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const document = getShopLegalDocument(slug);
  return document ? { title: document.title, description: document.summary } : { title: "Документ не найден" };
}

export default async function ShopLegalPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const document = getShopLegalDocument(slug);
  if (!document) notFound();

  return <div className={styles.shell}>
    <Link href="/shop" className={styles.cardLink}><ChevronLeft /> Вернуться в магазин</Link>
    <header className={styles.hero}>
      <div>
        <p className={styles.eyebrow}>Документы магазина · версия {SHOP_LEGAL_VERSION}</p>
        <h1 className={styles.title}>{document.title}</h1>
        <p className={styles.lead}>{document.summary}</p>
      </div>
    </header>

    <div className={styles.notice}>
      <ShieldCheck />
      <div><strong>Контакты магазина</strong><br />Email: <a href={`mailto:${SHOP_SUPPORT_EMAIL}`}>{SHOP_SUPPORT_EMAIL}</a> · Telegram: <a href={`https://t.me/${SHOP_SUPPORT_TELEGRAM.slice(1)}`} target="_blank" rel="noreferrer">{SHOP_SUPPORT_TELEGRAM}</a></div>
    </div>

    <nav className={styles.categoryRail} aria-label="Документы магазина">
      {shopLegalDocuments.map((item) => <Link key={item.slug} href={`/shop/legal/${item.slug}`} className={item.slug === slug ? styles.chipActive : styles.chip}>{item.title}</Link>)}
    </nav>

    <article className={styles.section}>
      {document.sections.map((section) => <section key={section.title} className={styles.trustCard} style={{ marginBottom: ".75rem" }}>
        <FileCheck2 />
        <h2>{section.title}</h2>
        {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        {section.items ? <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      </section>)}
    </article>

  </div>;
}
