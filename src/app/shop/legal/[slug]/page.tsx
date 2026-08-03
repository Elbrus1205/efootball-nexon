import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ExternalLink, FileCheck2 } from "lucide-react";
import { notFound } from "next/navigation";
import { getShopLegalDocument, shopLegalDocuments } from "@/lib/shop/legal";
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
        <p className={styles.eyebrow}>Документы магазина · версия shop-draft-1</p>
        <h1 className={styles.title}>{document.title}</h1>
        <p className={styles.lead}>{document.summary}</p>
      </div>
    </header>

    <div className={styles.warning}>
      <AlertTriangle />
      <div><strong>Требуется ручная юридическая проверка</strong><br />Это рабочая структура, а не опубликованная оферта или юридическая консультация. Магазин и оплата по умолчанию выключены.</div>
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

    <section className={styles.notice}>
      <ExternalLink />
      <div>
        <strong>Материалы для обязательной проверки перед запуском</strong><br />
        <a href="https://legal.konami.com/games/efootball/terms/tou/en-gb.html" target="_blank" rel="noreferrer">Условия использования eFootball™ от KONAMI</a>
        {" · "}
        <a href="https://www.konami.com/efootball/en/topic/news/4749" target="_blank" rel="noreferrer">предупреждение KONAMI о сторонних сайтах и передаче данных</a>
      </div>
    </section>
  </div>;
}
