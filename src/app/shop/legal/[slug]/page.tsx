import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  FileText,
  Headphones,
  Mail,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { notFound } from "next/navigation";
import {
  getShopLegalDocument,
  SHOP_LEGAL_VERSION,
  SHOP_SUPPORT_EMAIL,
  SHOP_SUPPORT_TELEGRAM,
  shopLegalDocuments,
} from "@/lib/shop/legal";
import styles from "@/components/shop/shop.module.css";

export function generateStaticParams() {
  return shopLegalDocuments.map(({ slug }) => ({ slug }));
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const document = getShopLegalDocument(slug);
  return document
    ? {
        title: document.title,
        description: document.summary,
        alternates: { canonical: `/shop/legal/${document.slug}` },
      }
    : { title: "Документ не найден" };
}

function formatVersionDate(version: string) {
  const datePart = version.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (!datePart) return version;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${datePart}T00:00:00Z`));
}

export default async function ShopLegalPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const document = getShopLegalDocument(slug);
  if (!document) notFound();

  const telegramHref = `https://t.me/${SHOP_SUPPORT_TELEGRAM.slice(1)}`;
  const versionDate = formatVersionDate(SHOP_LEGAL_VERSION);

  return (
    <div className={`${styles.shell} ${styles.legalShell}`}>
      <a className={styles.legalSkipLink} href="#legal-content">Перейти к содержанию документа</a>

      <Link href="/shop" className={styles.legalBackLink}>
        <ArrowLeft aria-hidden="true" />
        <span>Вернуться в магазин</span>
      </Link>

      <header className={styles.legalHero}>
        <div className={styles.legalHeroIcon} aria-hidden="true"><ShieldCheck /></div>
        <div className={styles.legalHeroCopy}>
          <p className={styles.legalEyebrow}>Правовой центр eFootball Nexon</p>
          <h1>{document.title}</h1>
          <p>{document.summary}</p>
          <div className={styles.legalMeta} aria-label="Информация о документе">
            <span><CalendarDays aria-hidden="true" /> Редакция от {versionDate}</span>
            <span><FileText aria-hidden="true" /> {document.sections.length} разделов</span>
          </div>
        </div>
      </header>

      <nav className={styles.legalDocumentNav} aria-label="Документы магазина">
        {shopLegalDocuments.map((item, index) => {
          const isActive = item.slug === slug;
          return (
            <Link
              key={item.slug}
              href={`/shop/legal/${item.slug}`}
              className={isActive ? styles.legalDocumentLinkActive : styles.legalDocumentLink}
              aria-current={isActive ? "page" : undefined}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.title}</strong>
              <ChevronRight aria-hidden="true" />
            </Link>
          );
        })}
      </nav>

      <div className={styles.legalLayout}>
        <aside className={styles.legalSidebar} aria-label="Навигация по документу">
          <div className={styles.legalToc}>
            <p>Содержание</p>
            <ol>
              {document.sections.map((section, index) => (
                <li key={section.title}><a href={`#section-${index + 1}`}>{section.title}</a></li>
              ))}
            </ol>
          </div>

          <div className={styles.legalSupportCard}>
            <Headphones aria-hidden="true" />
            <div>
              <strong>Нужна помощь?</strong>
              <p>Укажите номер заказа — так мы быстрее разберёмся в ситуации.</p>
            </div>
            <a href={`mailto:${SHOP_SUPPORT_EMAIL}`}><Mail aria-hidden="true" /> Email</a>
            <a href={telegramHref} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" /> Telegram</a>
          </div>
        </aside>

        <article id="legal-content" className={styles.legalArticle}>
          <div className={styles.legalArticleIntro}>
            <FileText aria-hidden="true" />
            <p>Документ действует для заказов, оформленных в магазине eFootball Nexon. Пожалуйста, ознакомьтесь со всеми разделами до оплаты.</p>
          </div>

          {document.sections.map((section, index) => (
            <section id={`section-${index + 1}`} key={section.title} className={styles.legalSection}>
              <div className={styles.legalSectionHead}>
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <h2>{section.title}</h2>
              </div>
              <div className={styles.legalSectionBody}>
                {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.items ? <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul> : null}
              </div>
            </section>
          ))}

          <footer className={styles.legalArticleFooter}>
            <ShieldCheck aria-hidden="true" />
            <div>
              <strong>Актуальная редакция</strong>
              <p>Опубликована {versionDate}. Сохраните ссылку на документ для быстрого доступа.</p>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}
