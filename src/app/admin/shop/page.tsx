import Link from "next/link";
import { BarChart3, Boxes, ChevronDown, CircleDollarSign, PackageCheck, Settings2, ShieldCheck, ShoppingBag, Star, Tag, TicketPercent, Users } from "lucide-react";
import { ShopProductForm } from "@/components/admin/shop-product-form";
import { requireAnyPermission } from "@/lib/auth/session";
import { getShopAdminDashboard } from "@/lib/shop/admin";
import { defaultShopSettings } from "@/lib/shop/config";
import { formatShopMoney, shopOrderStatusLabels } from "@/lib/shop/format";
import { getShopPermissionIds } from "@/lib/shop/permissions";
import { formatMoscowDateTimeLocalInput } from "@/lib/utils";
import styles from "@/components/shop/shop.module.css";

export const dynamic = "force-dynamic";

function Hint({ children }: { children: React.ReactNode }) {
  return <small className={styles.helper}>{children}</small>;
}

function Editor({ title, caption, children, open = false }: { title: string; caption: string; children: React.ReactNode; open?: boolean }) {
  return <details className={styles.adminEditor} open={open}>
    <summary><span><strong>{title}</strong><small>{caption}</small></span><ChevronDown aria-hidden="true" /></summary>
    <div className={styles.adminEditorBody}>{children}</div>
  </details>;
}

export default async function AdminShopPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireAnyPermission(["shop.support", "shop.manage"]);
  const params = await props.searchParams;
  const days = Number.parseInt(String(params.days ?? "30"), 10);
  const [data, permissions] = await Promise.all([getShopAdminDashboard(days), getShopPermissionIds(session.user.id)]);
  const canManage = permissions.includes("shop.manage");
  const settings = data.settings ?? defaultShopSettings;
  const categoryOptions = data.categories.map(({ id, name }) => ({ id, name }));

  return <div className="space-y-6">
    {typeof params.saved === "string" ? <div className={styles.success}><ShieldCheck /> Изменения магазина сохранены.</div> : null}
    {typeof params.error === "string" ? <div className={styles.warning}>{params.error}</div> : null}

    <section>
      <div className={styles.sectionHead}>
        <div><p className={styles.eyebrow}>Период: {days} дней</p><h1 className={styles.sectionTitle}>Показатели магазина</h1></div>
        <form className={styles.periodForm}><select name="days" className={styles.select} defaultValue={days}><option value="7">7 дней</option><option value="30">30 дней</option><option value="90">90 дней</option><option value="365">Год</option></select><button className={styles.buttonSecondary}>Применить</button></form>
      </div>
      <div className={styles.statGrid}>{[
        { label: "Выручка", value: formatShopMoney(data.metrics.revenueMinor), icon: CircleDollarSign },
        { label: "Заказы", value: data.metrics.orders, icon: ShoppingBag },
        { label: "Средний чек", value: formatShopMoney(data.metrics.averageOrderMinor), icon: BarChart3 },
        { label: "Завершены", value: data.metrics.completed, icon: PackageCheck },
        { label: "Успешные оплаты", value: data.metrics.successfulPayments, icon: ShieldCheck },
        { label: "Возвраты", value: data.metrics.refunds, icon: CircleDollarSign },
        { label: "Споры", value: data.metrics.disputes, icon: ShieldCheck },
        { label: "Отзывы на модерации", value: data.metrics.pendingReviews, icon: Star },
      ].map((metric) => <article className={styles.statCard} key={metric.label}><metric.icon size={18} /><span>{metric.label}</span><strong>{metric.value}</strong></article>)}</div>
    </section>

    {canManage ? <section>
      <div className={styles.sectionHead}><div><p className={styles.eyebrow}>Создание и настройки</p><h2 className={styles.sectionTitle}>Управление магазином</h2><p className={styles.sectionText}>Формы свёрнуты, чтобы раздел оставался компактным на телефоне.</p></div></div>
      <div className={styles.editorStack}>
        <Editor title="Настройки магазина" caption="Доступность, сроки заказов и юридическая версия" open>
          <form action="/api/admin/shop" method="post" className={styles.adminForm}>
            <input type="hidden" name="_action" value="saveSettings" />
            <div className={styles.switchGrid}>
              <label className={styles.checkLabel}><input type="checkbox" name="isEnabled" value="true" defaultChecked={settings.isEnabled} /> Магазин включён<Hint>Показывает каталог как доступный. Оплата всё равно требует Platega.</Hint></label>
              <label className={styles.checkLabel}><input type="checkbox" name="maintenanceMode" value="true" defaultChecked={settings.maintenanceMode} /> Технические работы<Hint>Каталог виден, но оформление временно закрыто.</Hint></label>
              <label className={styles.checkLabel}><input type="checkbox" name="showHomeBlock" value="true" defaultChecked={settings.showHomeBlock} /> Блок на главной<Hint>Показывает до трёх реальных популярных товаров.</Hint></label>
              <label className={styles.checkLabel}><input type="checkbox" name="autoCompleteEnabled" value="true" defaultChecked={settings.autoCompleteEnabled} /> Автозавершение<Hint>Если продавец выполнил заказ, а покупатель не ответил за время проверки, заказ завершится автоматически.</Hint></label>
            </div>
            <div className={styles.formRow}>
              <label className={styles.fieldLabel}>Валюта<input className={styles.input} name="currency" defaultValue={settings.currency} /><Hint>Трёхбуквенный код, например RUB.</Hint></label>
              <label className={styles.fieldLabel}>Версия условий<input className={styles.input} name="termsVersion" defaultValue={settings.termsVersion} /><Hint>Измените значение после обновления правил. Покупатель должен принять новую версию.</Hint></label>
              <label className={styles.fieldLabel}>Минимальная сумма, ₽<input className={styles.input} name="minimumOrder" defaultValue={settings.minimumOrderMinor / 100} /><Hint>Заказ дешевле этой суммы создать нельзя.</Hint></label>
              <label className={styles.fieldLabel}>Максимальная сумма, ₽<input className={styles.input} name="maximumOrder" defaultValue={settings.maximumOrderMinor / 100} /><Hint>Защищает от случайно слишком крупных заказов.</Hint></label>
            </div>
            <div className={styles.formRow}>
              <label className={styles.fieldLabel}>Оплата, мин<input className={styles.input} name="paymentTimeoutMinutes" type="number" min="1" defaultValue={settings.paymentTimeoutMinutes} /><Hint>Сколько живёт платёжная ссылка и резерв товара.</Hint></label>
              <label className={styles.fieldLabel}>Принятие, мин<input className={styles.input} name="sellerAcceptTimeoutMinutes" type="number" min="1" defaultValue={settings.sellerAcceptTimeoutMinutes} /><Hint>Сколько продавец может принимать назначенный заказ до переназначения.</Hint></label>
              <label className={styles.fieldLabel}>Выполнение, мин<input className={styles.input} name="fulfillmentTimeoutMinutes" type="number" min="1" defaultValue={settings.fulfillmentTimeoutMinutes} /><Hint>Резервный срок выполнения, если у товара не задан свой.</Hint></label>
              <label className={styles.fieldLabel}>Проверка, мин<input className={styles.input} name="buyerConfirmTimeoutMinutes" type="number" min="1" defaultValue={settings.buyerConfirmTimeoutMinutes} /><Hint>Сколько покупатель может подтвердить получение или открыть спор.</Hint></label>
            </div>
            <label className={styles.fieldLabel}>Контакты поддержки<input className={styles.input} name="supportContact" defaultValue={settings.supportContact ?? ""} placeholder="Например: @efootball_nexon" /><Hint>Показываются покупателю при вопросах по заказу.</Hint></label>
            <input type="hidden" name="cancellationEnabled" value="true" /><input type="hidden" name="reviewModerationEnabled" value="true" />
            <button className={styles.button}><Settings2 /> Сохранить настройки</button>
          </form>
        </Editor>

        <Editor title="Создать категорию" caption="Новый раздел каталога">
          <form action="/api/admin/shop" method="post" className={styles.adminForm}>
            <input type="hidden" name="_action" value="createCategory" />
            <div className={styles.formRow}><label className={styles.fieldLabel}>Название<input className={styles.input} name="name" required minLength={2} placeholder="Внутриигровые донаты" /><Hint>Показывается покупателю в каталоге.</Hint></label><label className={styles.fieldLabel}>Slug<input className={styles.input} name="slug" required pattern="[a-z0-9-]+" placeholder="in-game-donations" /><Hint>Системный адрес категории: латиница, цифры и дефисы.</Hint></label></div>
            <label className={styles.fieldLabel}>Описание<textarea className={styles.textarea} name="description" placeholder="Что объединяет товары этой категории" /><Hint>Коротко объясняет назначение категории.</Hint></label>
            <label className={styles.fieldLabel}>Порядок<input className={styles.input} name="sortOrder" type="number" defaultValue="0" /><Hint>Меньшее число поднимает категорию выше.</Hint></label>
            <button className={styles.button}><Boxes /> Создать категорию</button>
          </form>
        </Editor>

        <Editor title="Создать товар" caption="Карточка, цена, остаток и изображение">
          <ShopProductForm categories={categoryOptions} />
        </Editor>

        <Editor title="Добавить продавца" caption="Назначение пользователя и лимиты">
          <form action="/api/admin/shop" method="post" className={styles.adminForm}>
            <input type="hidden" name="_action" value="addSeller" />
            <label className={styles.fieldLabel}>Публичный ID пользователя<input className={styles.input} name="publicId" required /><Hint>ID из профиля пользователя. Глобальная роль аккаунта не меняется.</Hint></label>
            <div className={styles.formRow}><label className={styles.fieldLabel}>Лимит активных заказов<input className={styles.input} name="maxActiveOrders" type="number" min="1" defaultValue="3" /><Hint>Больше этого количества продавцу не назначается.</Hint></label><label className={styles.fieldLabel}>Комиссия, %<input className={styles.input} name="commissionPercent" type="number" min="0" max="100" step="0.01" defaultValue="30" /><Hint>Доля платформы. Пример: 30 означает 30%.</Hint></label></div>
            <button className={styles.button}><Users /> Назначить продавцом</button>
          </form>
        </Editor>

        <Editor title="Создать акцию" caption="Скидка для выбранного товара и реальные даты">
          <form action="/api/admin/shop" method="post" className={styles.adminForm}>
            <input type="hidden" name="_action" value="createPromotion" />
            <label className={styles.fieldLabel}>Название<input className={styles.input} name="name" required placeholder="Летнее предложение" /><Hint>Внутреннее понятное название акции.</Hint></label>
            <label className={styles.fieldLabel}>Описание<textarea className={styles.textarea} name="description" placeholder="Коротко объясните покупателю, в чём выгода акции" /><Hint>Пояснение к акции; можно оставить пустым.</Hint></label>
            <label className={styles.fieldLabel}>Товар<select className={styles.select} name="productId" required>{data.products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}</select><Hint>Акция изменит цену только выбранного товара.</Hint></label>
            <div className={styles.formRow}><label className={styles.fieldLabel}>Тип скидки<select className={styles.select} name="discountType"><option value="PERCENT">Процент</option><option value="FIXED">Сумма в рублях</option></select><Hint>Процент от цены или фиксированная сумма.</Hint></label><label className={styles.fieldLabel}>Размер скидки<input className={styles.input} name="discountValue" required /><Hint>Например 10 для 10% или 300 для 300 ₽.</Hint></label></div>
            <div className={styles.formRow}><label className={styles.fieldLabel}>Начало<input className={styles.input} name="startsAt" type="datetime-local" required /><Hint>До этой даты скидка не применяется.</Hint></label><label className={styles.fieldLabel}>Конец<input className={styles.input} name="endsAt" type="datetime-local" required /><Hint>После даты цена вернётся автоматически.</Hint></label></div>
            <label className={styles.checkLabel}><input name="showCountdown" type="checkbox" value="true" /> Показывать таймер<Hint>Таймер использует настоящую дату окончания без искусственной срочности.</Hint></label>
            <button className={styles.button}><Tag /> Создать акцию</button>
          </form>
        </Editor>

        <Editor title="Создать промокод" caption="Дополнительная скидка с лимитами">
          <form action="/api/admin/shop" method="post" className={styles.adminForm}>
            <input type="hidden" name="_action" value="createPromoCode" />
            <div className={styles.formRow}><label className={styles.fieldLabel}>Код<input className={styles.input} name="code" required placeholder="NEXON10" /><Hint>Покупатель вводит этот код при оформлении.</Hint></label><label className={styles.fieldLabel}>Тип скидки<select className={styles.select} name="discountType"><option value="PERCENT">Процент</option><option value="FIXED">Сумма в рублях</option></select><Hint>Как рассчитывать скидку.</Hint></label></div>
            <label className={styles.fieldLabel}>Описание<textarea className={styles.textarea} name="description" placeholder="Например: скидка новым игрокам до конца недели" /><Hint>Поясняет назначение промокода; можно оставить пустым.</Hint></label>
            <div className={styles.formRow}><label className={styles.fieldLabel}>Размер скидки<input className={styles.input} name="discountValue" required /><Hint>Процент или рубли — зависит от типа.</Hint></label><label className={styles.fieldLabel}>Минимальная сумма, ₽<input className={styles.input} name="minimumSubtotal" defaultValue="0" /><Hint>До этой суммы промокод не применяется.</Hint></label></div>
            <div className={styles.formRow}><label className={styles.fieldLabel}>Начало<input className={styles.input} name="startsAt" type="datetime-local" required /></label><label className={styles.fieldLabel}>Конец<input className={styles.input} name="endsAt" type="datetime-local" required /></label></div>
            <div className={styles.formRow}><label className={styles.fieldLabel}>Общий лимит<input className={styles.input} name="totalUsageLimit" type="number" min="1" /><Hint>Оставьте пустым для отсутствия общего лимита.</Hint></label><label className={styles.fieldLabel}>На пользователя<input className={styles.input} name="perUserUsageLimit" type="number" min="1" defaultValue="1" /><Hint>Сколько раз один пользователь может применить код.</Hint></label></div>
            <label className={styles.checkLabel}><input name="newUsersOnly" type="checkbox" value="true" /> Только первая покупка<Hint>Промокод доступен пользователям без прошлых заказов.</Hint></label>
            <button className={styles.button}><TicketPercent /> Создать промокод</button>
          </form>
        </Editor>
      </div>
    </section> : <div className={styles.notice}><ShieldCheck /> У вас есть права поддержки заказов без доступа к ценам, каталогу и продавцам.</div>}

    {canManage ? <section>
      <div className={styles.sectionHead}><div><p className={styles.eyebrow}>Редактирование</p><h2 className={styles.sectionTitle}>Категории</h2></div></div>
      <div className={styles.editorStack}>{data.categories.map((category) => <Editor key={category.id} title={category.name} caption={`/${category.slug} · ${category.isActive ? "показывается" : "скрыта"}`}>
        <form action="/api/admin/shop" method="post" className={styles.adminForm}><input type="hidden" name="_action" value="updateCategory" /><input type="hidden" name="id" value={category.id} /><div className={styles.formRow}><label className={styles.fieldLabel}>Название<input className={styles.input} name="name" required defaultValue={category.name} /></label><label className={styles.fieldLabel}>Slug<input className={styles.input} name="slug" required pattern="[a-z0-9-]+" defaultValue={category.slug} /></label></div><label className={styles.fieldLabel}>Описание<textarea className={styles.textarea} name="description" defaultValue={category.description ?? ""} /></label><div className={styles.formRow}><label className={styles.fieldLabel}>Порядок<input className={styles.input} name="sortOrder" type="number" defaultValue={category.sortOrder} /></label><label className={styles.checkLabel}><input type="checkbox" name="isActive" value="true" defaultChecked={category.isActive} /> Показывать категорию</label></div><button className={styles.button}>Сохранить категорию</button></form>
      </Editor>)}</div>
    </section> : null}

    <section>
      <div className={styles.sectionHead}><div><p className={styles.eyebrow}>Каталог</p><h2 className={styles.sectionTitle}>Товары</h2><p className={styles.sectionText}>Редактор открывается по нажатию и не растягивает страницу.</p></div><Link className={styles.buttonSecondary} href="/shop">Открыть магазин</Link></div>
      {data.products.length ? <div className={styles.editorStack}>{data.products.map((product) => {
        const variant = product.variants[0];
        return <Editor key={product.id} title={product.title} caption={`${product.category.name} · ${variant ? formatShopMoney(variant.priceMinor) : "нет варианта"} · ${product.isActive ? "опубликован" : "черновик"}`}>
          {canManage && variant ? <>
            <ShopProductForm categories={categoryOptions} initial={{ id: product.id, variantId: variant.id, categoryId: product.categoryId, type: product.type, title: product.title, slug: product.slug, sku: variant.sku, variantName: variant.name, price: String(variant.priceMinor / 100), stockMode: variant.stockMode, stockQuantity: variant.stockQuantity, estimatedMinutes: variant.estimatedMinutes ?? product.estimatedMinutes, maxPerOrder: variant.maxPerOrder, imageUrl: product.images[0]?.url ?? "", shortDescription: product.shortDescription, description: product.description, fulfillmentTerms: product.fulfillmentTerms, isActive: product.isActive, isFeatured: product.isFeatured, isPopular: product.isPopular }} />
            <div className={styles.subEditor}><h3>Поля покупателя</h3><p className={styles.sectionText}>Например игровой ID или регион. Пароли и коды доступа запрещены.</p>{product.fields.map((field) => <form action="/api/admin/shop" method="post" className={styles.compactEditForm} key={field.id}><input type="hidden" name="_action" value="updateField" /><input type="hidden" name="id" value={field.id} /><input className={styles.input} name="label" defaultValue={field.label} aria-label="Название поля" /><input className={styles.input} name="description" defaultValue={field.description ?? ""} placeholder="Подсказка покупателю" aria-label="Описание поля" /><label className={styles.checkLabel}><input type="checkbox" name="isRequired" value="true" defaultChecked={field.isRequired} /> Обязательное</label><button className={styles.buttonSecondary}>Сохранить поле</button></form>)}<form action="/api/admin/shop" method="post" className={styles.compactEditForm}><input type="hidden" name="_action" value="createField" /><input type="hidden" name="productId" value={product.id} /><input className={styles.input} name="key" required pattern="[a-zA-Z][a-zA-Z0-9_-]*" placeholder="gameId" aria-label="Ключ поля" /><input className={styles.input} name="label" required placeholder="Игровой ID" aria-label="Название поля" /><input className={styles.input} name="description" placeholder="Где найти этот ID" aria-label="Описание поля" /><input type="hidden" name="fieldType" value="TEXT" /><label className={styles.checkLabel}><input type="checkbox" name="isRequired" value="true" defaultChecked /> Обязательное</label><button className={styles.buttonSecondary}>Добавить поле</button></form></div>
          </> : <p className={styles.sectionText}>У товара нет доступного варианта для редактирования.</p>}
        </Editor>;
      })}</div> : <div className={styles.empty}><div><ShoppingBag /><h3>Товаров пока нет</h3><p>Откройте форму «Создать товар» выше.</p></div></div>}
    </section>

    {canManage ? <section><div className={styles.sectionHead}><div><p className={styles.eyebrow}>Скидки</p><h2 className={styles.sectionTitle}>Акции</h2></div></div><div className={styles.editorStack}>{data.promotions.map((promotion) => <Editor key={promotion.id} title={promotion.name} caption={`${promotion.products[0]?.product.title ?? "Без товара"} · ${promotion.isActive ? "активна" : "выключена"}`}><form action="/api/admin/shop" method="post" className={styles.adminForm}><input type="hidden" name="_action" value="updatePromotion" /><input type="hidden" name="id" value={promotion.id} /><label className={styles.fieldLabel}>Название<input className={styles.input} name="name" required defaultValue={promotion.name} /></label><label className={styles.fieldLabel}>Товар<select className={styles.select} name="productId" defaultValue={promotion.products[0]?.productId}>{data.products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}</select></label><div className={styles.formRow}><label className={styles.fieldLabel}>Тип<select className={styles.select} name="discountType" defaultValue={promotion.discountType}><option value="PERCENT">Процент</option><option value="FIXED">Сумма в рублях</option></select></label><label className={styles.fieldLabel}>Скидка<input className={styles.input} name="discountValue" defaultValue={promotion.discountType === "FIXED" ? promotion.discountValue / 100 : promotion.discountValue} /></label></div><div className={styles.formRow}><label className={styles.fieldLabel}>Начало<input className={styles.input} name="startsAt" type="datetime-local" defaultValue={formatMoscowDateTimeLocalInput(promotion.startsAt)} /></label><label className={styles.fieldLabel}>Конец<input className={styles.input} name="endsAt" type="datetime-local" defaultValue={formatMoscowDateTimeLocalInput(promotion.endsAt)} /></label></div><div className={styles.switchGrid}><label className={styles.checkLabel}><input type="checkbox" name="isActive" value="true" defaultChecked={promotion.isActive} /> Акция включена</label><label className={styles.checkLabel}><input type="checkbox" name="showCountdown" value="true" defaultChecked={promotion.showCountdown} /> Показывать таймер</label></div><button className={styles.button}>Сохранить акцию</button></form></Editor>)}</div></section> : null}

    {canManage ? <section><div className={styles.sectionHead}><div><p className={styles.eyebrow}>Скидки</p><h2 className={styles.sectionTitle}>Промокоды</h2></div></div><div className={styles.editorStack}>{data.promoCodes.map((promo) => <Editor key={promo.id} title={promo.code} caption={`${promo._count.usages} применений · ${promo.isActive ? "включён" : "выключен"}`}><form action="/api/admin/shop" method="post" className={styles.adminForm}><input type="hidden" name="_action" value="updatePromoCode" /><input type="hidden" name="id" value={promo.id} /><div className={styles.formRow}><label className={styles.fieldLabel}>Код<input className={styles.input} name="code" required defaultValue={promo.code} /></label><label className={styles.fieldLabel}>Тип<select className={styles.select} name="discountType" defaultValue={promo.discountType}><option value="PERCENT">Процент</option><option value="FIXED">Сумма в рублях</option></select></label></div><div className={styles.formRow}><label className={styles.fieldLabel}>Скидка<input className={styles.input} name="discountValue" defaultValue={promo.discountType === "FIXED" ? promo.discountValue / 100 : promo.discountValue} /></label><label className={styles.fieldLabel}>Минимум, ₽<input className={styles.input} name="minimumSubtotal" defaultValue={promo.minimumSubtotalMinor / 100} /></label></div><div className={styles.formRow}><label className={styles.fieldLabel}>Начало<input className={styles.input} name="startsAt" type="datetime-local" defaultValue={formatMoscowDateTimeLocalInput(promo.startsAt)} /></label><label className={styles.fieldLabel}>Конец<input className={styles.input} name="endsAt" type="datetime-local" defaultValue={formatMoscowDateTimeLocalInput(promo.endsAt)} /></label></div><div className={styles.formRow}><label className={styles.fieldLabel}>Общий лимит<input className={styles.input} name="totalUsageLimit" type="number" defaultValue={promo.totalUsageLimit ?? ""} /></label><label className={styles.fieldLabel}>На пользователя<input className={styles.input} name="perUserUsageLimit" type="number" defaultValue={promo.perUserUsageLimit} /></label></div><div className={styles.switchGrid}><label className={styles.checkLabel}><input type="checkbox" name="isActive" value="true" defaultChecked={promo.isActive} /> Промокод включён</label><label className={styles.checkLabel}><input type="checkbox" name="newUsersOnly" value="true" defaultChecked={promo.newUsersOnly} /> Только первая покупка</label></div><button className={styles.button}>Сохранить промокод</button></form></Editor>)}</div></section> : null}

    <section><div className={styles.sectionHead}><div><p className={styles.eyebrow}>Контекстные роли</p><h2 className={styles.sectionTitle}>Продавцы</h2></div></div><div className={styles.editorStack}>{data.sellers.map((seller) => <Editor key={seller.id} title={seller.user.name ?? seller.user.publicId} caption={`@${seller.user.telegramUsername ?? "без Telegram"} · ${seller._count.orders}/${seller.maxActiveOrders} активных`}><div className={styles.adminForm}><span className={styles.status}>{seller.isActive ? "Работает" : "Отключён"}</span>{canManage ? <><form action="/api/admin/shop" method="post" className={styles.adminForm}><input type="hidden" name="_action" value="updateSeller" /><input type="hidden" name="id" value={seller.id} /><div className={styles.formRow}><label className={styles.fieldLabel}>Лимит активных заказов<input className={styles.input} name="maxActiveOrders" type="number" min="1" defaultValue={seller.maxActiveOrders} /></label><label className={styles.fieldLabel}>Комиссия, %<input className={styles.input} name="commissionPercent" type="number" min="0" max="100" step="0.01" defaultValue={seller.commissionBps / 100} /></label></div><label className={styles.checkLabel}><input type="checkbox" name="isActive" value="true" defaultChecked={seller.isActive} /> Продавец активен</label><button className={styles.button}>Сохранить продавца</button></form><form action="/api/admin/shop" method="post" className={styles.compactEditForm}><input type="hidden" name="_action" value="assignSellerProduct" /><input type="hidden" name="sellerId" value={seller.id} /><select className={styles.select} name="productId">{data.products.map((product) => <option value={product.id} key={product.id}>{product.title}</option>)}</select><button className={styles.buttonSecondary}>Назначить товар</button></form></> : null}</div></Editor>)}</div></section>

    <section><div className={styles.sectionHead}><div><p className={styles.eyebrow}>Последние {days} дней</p><h2 className={styles.sectionTitle}>Заказы и споры</h2></div></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Заказ</th><th>Покупатель</th><th>Продавец</th><th>Статус</th><th>Сумма</th><th /></tr></thead><tbody>{data.orders.map((order) => <tr key={order.id}><td>{order.orderNumber}<br /><small>{order.items[0]?.productTitle}</small></td><td>{order.buyer.name ?? "Пользователь"}</td><td>{order.seller?.user.name ?? "Не назначен"}</td><td><span className={styles.status}>{shopOrderStatusLabels[order.status]}</span></td><td>{formatShopMoney(order.totalMinor, order.currency)}</td><td><Link className={styles.cardLink} href={`/shop/orders/${order.id}`}>Открыть</Link></td></tr>)}</tbody></table></div></section>

    {data.orders.some((order) => order.status === "DISPUTE") ? <section><div className={styles.sectionHead}><div><p className={styles.eyebrow}>Требуют решения</p><h2 className={styles.sectionTitle}>Открытые споры</h2></div></div><div className={styles.adminGrid}>{data.orders.filter((order) => order.status === "DISPUTE").map((order) => <form action="/api/admin/shop" method="post" className={`${styles.adminCard} ${styles.adminForm}`} key={order.id}><input type="hidden" name="_action" value="resolveDispute" /><input type="hidden" name="orderId" value={order.id} /><h2>{order.orderNumber}</h2><p className={styles.sectionText}>{order.items[0]?.productTitle} · {formatShopMoney(order.totalMinor, order.currency)}</p><label className={styles.fieldLabel}>Решение<textarea className={styles.textarea} name="resolution" minLength={5} required /><Hint>Объяснение сохранится в истории заказа.</Hint></label><label className={styles.fieldLabel}>Исход<select className={styles.select} name="targetStatus"><option value="IN_PROGRESS">Повторное выполнение</option><option value="COMPLETED">Завершить заказ</option><option value="REFUND_PENDING">Создать возврат</option><option value="CANCELLED">Отменить</option></select></label><label className={styles.fieldLabel}>Сумма возврата, ₽<input className={styles.input} name="refundAmount" inputMode="decimal" /><Hint>Оставьте пустым для полного возврата.</Hint></label><button className={styles.button}>Зафиксировать решение</button></form>)}</div></section> : null}

    <div className={styles.warning}><ShieldCheck /><div><strong>Юридическая проверка обязательна</strong><br />Правила магазина, возвратов, споров и обработки игровых данных должны быть проверены юристом до включения продаж.</div></div>
  </div>;
}
