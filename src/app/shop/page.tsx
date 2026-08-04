import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, History, MessageSquareText, ShieldCheck, ShoppingBag, Sparkles } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";
import { listShopCategories, listShopProducts } from "@/lib/shop/catalog";
import { getShopAvailability, getShopSettings } from "@/lib/shop/config";
import { ProductCard } from "@/components/shop/product-card";
import styles from "@/components/shop/shop.module.css";

const fallbackReviewsTelegramUrl = process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL ?? "https://t.me/efootball_nexon";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Магазин",
  description: "Игровые донаты eFootball с прозрачным статусом заказа и сопровождением в Telegram.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const category = one(params.category);
  const page = Number.parseInt(one(params.page) ?? "1", 10);
  const [settings, categories, products, session] = await Promise.all([
    getShopSettings(),
    listShopCategories(),
    listShopProducts({
      category,
      sort: "popular",
      page,
    }),
    getCurrentSession(),
  ]);
  const availability = getShopAvailability(settings);
  const reviewsTelegramUrl = settings.reviewsTelegramUrl ?? fallbackReviewsTelegramUrl;
  const pageHref = (targetPage: number) => category
    ? `/shop?category=${encodeURIComponent(category)}&page=${targetPage}`
    : `/shop?page=${targetPage}`;

  return (
    <div className={styles.shell}>
      <header className={styles.hero}>
        <div><p className={styles.eyebrow}>eFootball Nexon · безопасная покупка</p><h1 className={styles.title}>Магазин</h1></div>
        <div className={styles.heroActions}>
          <Link className={`${styles.shopHeaderAction} ${styles.ordersAction}`} href={session?.user ? "/shop/orders" : "/login?callbackUrl=/shop/orders"}>
            <span className={styles.shopActionIcon}><History aria-hidden="true" /></span><span className={styles.shopActionCopy}><strong>Мои заказы</strong><small>Статусы и история</small></span><span className={styles.shopActionSignal} aria-hidden="true" />
          </Link>
          <Link className={`${styles.shopHeaderAction} ${styles.reviewsAction}`} href={reviewsTelegramUrl} target="_blank" rel="noreferrer">
            <span className={styles.shopActionIcon}><MessageSquareText aria-hidden="true" /></span><span className={styles.shopActionCopy}><strong>Наши отзывы</strong><small>Открыть в Telegram</small></span><ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </header>

      {!availability.available ? <div className={styles.warning}><ShoppingBag /><div><strong>Магазин сейчас недоступен</strong><br />{availability.reason}</div></div> : null}

      <nav className={styles.categoryRail} aria-label="Категории магазина">
        <Link href="/shop" className={!category ? styles.chipActive : styles.chip}>Все товары</Link>
        {categories.map((item) => <Link key={item.id} href={`/shop?category=${encodeURIComponent(item.slug)}`} className={category === item.slug ? styles.chipActive : styles.chip}>{item.name}</Link>)}
      </nav>

      <div className={styles.resultMeta}><span>Найдено: {products.total}</span><span>Страница {products.page} из {products.pageCount}</span></div>
      {products.items.length ? <div className={styles.grid}>{products.items.map((product) => <ProductCard key={product.id} product={product} currency={settings.currency} />)}</div> : (
        <div className={styles.empty}><div><ShoppingBag /><h2>В этой категории пока нет товаров</h2><p>Выберите другой раздел или вернитесь ко всем товарам.</p><div className={styles.inlineActions} style={{ justifyContent: "center", marginTop: "1rem" }}><Link className={styles.buttonSecondary} href="/shop">Все товары</Link></div></div></div>
      )}

      {products.pageCount > 1 ? <nav className={styles.inlineActions} aria-label="Страницы каталога" style={{ justifyContent: "center", marginTop: "1.25rem" }}>{products.page > 1 ? <Link className={styles.buttonSecondary} href={pageHref(products.page - 1)}>Назад</Link> : null}{products.page < products.pageCount ? <Link className={styles.buttonSecondary} href={pageHref(products.page + 1)}>Дальше</Link> : null}</nav> : null}

      <section className={styles.section}><div className={styles.sectionHead}><div><p className={styles.eyebrow}>Без скрытых шагов</p><h2 className={styles.sectionTitle}>Как проходит покупка</h2></div></div><div className={styles.stepsGrid}>
        <article className={styles.stepCard}><span className={styles.stepNumber}>Шаг 1</span><Sparkles /><h3>Выберите вариант</h3><p>Цена, скидка, остаток и время выполнения показываются до оформления.</p></article>
        <article className={styles.stepCard}><span className={styles.stepNumber}>Шаг 2</span><ShieldCheck /><h3>Проверьте данные</h3><p>Итог считается на сервере. Чувствительные игровые данные хранятся зашифрованно.</p></article>
        <article className={styles.stepCard}><span className={styles.stepNumber}>Шаг 3</span><History /><h3>Следите за заказом</h3><p>Каждый переход сохраняется в истории, а важные события приходят в Telegram.</p></article>
      </div></section>

      <section className={styles.section}><div className={styles.trustGrid}>
        <article className={styles.trustCard}><ShieldCheck /><h3>Подтверждение webhook</h3><p>Возврат на сайт не считается оплатой. Заказ запускается только после проверенного сообщения провайдера.</p></article>
        <article className={styles.trustCard}><History /><h3>Полная история</h3><p>Видно, кто и когда принял, начал, завершил или оспорил заказ.</p></article>
        <article className={styles.trustCard}><MessageSquareText /><h3>Поддержка споров</h3><p>При проблеме исполнение и выплата блокируются до решения поддержки.</p></article>
      </div></section>
    </div>
  );
}
