import type { Metadata } from "next";
import Link from "next/link";
import { History, MessageSquareText, Search, ShieldCheck, ShoppingBag, Sparkles } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";
import { listShopCategories, listShopProducts } from "@/lib/shop/catalog";
import { getShopAvailability, getShopSettings } from "@/lib/shop/config";
import { ProductCard } from "@/components/shop/product-card";
import { CatalogFilters } from "@/components/shop/catalog-filters";
import styles from "@/components/shop/shop.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Магазин",
  description: "Игровые донаты eFootball с прозрачным статусом заказа и сопровождением в Telegram.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function rublesToMinor(value?: string) {
  if (!value || !/^\d+(?:[.,]\d{1,2})?$/.test(value)) return undefined;
  const [whole, fraction = ""] = value.replace(",", ".").split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const values = {
    q: one(params.q), category: one(params.category), type: one(params.type), sort: one(params.sort),
    min: one(params.min), max: one(params.max), available: one(params.available), discounted: one(params.discounted),
  };
  const page = Number.parseInt(one(params.page) ?? "1", 10);
  const [settings, categories, products, session] = await Promise.all([
    getShopSettings(),
    listShopCategories(),
    listShopProducts({
      search: values.q,
      category: values.category,
      type: values.type === "PROMOTIONAL" ? "PROMOTIONAL" : values.type === "IN_GAME" ? "IN_GAME" : undefined,
      minPriceMinor: rublesToMinor(values.min),
      maxPriceMinor: rublesToMinor(values.max),
      availableOnly: values.available === "1",
      discountedOnly: values.discounted === "1",
      sort: ["popular", "new", "price-asc", "price-desc", "discount"].includes(values.sort ?? "") ? values.sort as "popular" : "popular",
      page,
    }),
    getCurrentSession(),
  ]);
  const availability = getShopAvailability(settings);

  return (
    <div className={styles.shell}>
      <header className={styles.hero}>
        <div><p className={styles.eyebrow}>eFootball Nexon · безопасная покупка</p><h1 className={styles.title}>Магазин</h1><p className={styles.lead}>Выберите донат, проверьте итоговую сумму и следите за исполнением заказа на сайте и в Telegram. Цена фиксируется до оплаты и не меняется продавцом.</p></div>
        <div className={styles.heroActions}>
          {session?.user ? <Link className={styles.buttonSecondary} href="/shop/orders"><History size={17} /> Мои заказы</Link> : <Link className={styles.button} href="/login?callbackUrl=/shop">Войти для покупки</Link>}
          <Link className={styles.buttonSecondary} href="/shop/reviews"><MessageSquareText size={17} /> Отзывы</Link>
        </div>
      </header>

      {!availability.available ? <div className={styles.warning}><ShoppingBag /><div><strong>Магазин сейчас недоступен</strong><br />{availability.reason}</div></div> : null}

      <form method="get">
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}><Search aria-hidden="true" /><input className={styles.input} type="search" name="q" defaultValue={values.q} placeholder="Найти монеты или донат" aria-label="Поиск товаров" /></div>
          <select className={styles.select} name="sort" defaultValue={values.sort ?? "popular"} aria-label="Сортировка">
            <option value="popular">Сначала популярные</option><option value="new">Сначала новые</option><option value="price-asc">Цена по возрастанию</option><option value="price-desc">Цена по убыванию</option><option value="discount">Максимальная скидка</option>
          </select>
          <CatalogFilters categories={categories} values={values} />
          <button className={styles.button} type="submit">Найти</button>
        </div>
        <nav className={styles.categoryRail} aria-label="Категории магазина">
          <Link href="/shop" className={!values.category ? styles.chipActive : styles.chip}>Все товары</Link>
          {categories.map((category) => <Link key={category.id} href={`/shop?category=${encodeURIComponent(category.slug)}`} className={values.category === category.slug ? styles.chipActive : styles.chip}>{category.name}</Link>)}
        </nav>
      </form>

      <div className={styles.resultMeta}><span>Найдено: {products.total}</span><span>Страница {products.page} из {products.pageCount}</span></div>
      {products.items.length ? <div className={styles.grid}>{products.items.map((product) => <ProductCard key={product.id} product={product} currency={settings.currency} />)}</div> : (
        <div className={styles.empty}><div><Search /><h2>Товары не найдены</h2><p>Измените запрос или сбросьте фильтры. Если каталог ещё пуст, первый товар можно создать в админ-панели.</p><div className={styles.inlineActions} style={{ justifyContent: "center", marginTop: "1rem" }}><Link className={styles.buttonSecondary} href="/shop">Сбросить фильтры</Link></div></div></div>
      )}

      {products.pageCount > 1 ? <nav className={styles.inlineActions} aria-label="Страницы каталога" style={{ justifyContent: "center", marginTop: "1.25rem" }}>{products.page > 1 ? <Link className={styles.buttonSecondary} href={`/shop?page=${products.page - 1}`}>Назад</Link> : null}{products.page < products.pageCount ? <Link className={styles.buttonSecondary} href={`/shop?page=${products.page + 1}`}>Дальше</Link> : null}</nav> : null}

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
