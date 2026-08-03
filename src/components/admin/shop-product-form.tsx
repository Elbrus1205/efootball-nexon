"use client";

import Image from "next/image";
import { ImagePlus, Loader2, PackagePlus, Save } from "lucide-react";
import { useId, useState, type ChangeEvent } from "react";
import { uploadFile } from "@/lib/storage/upload-client";
import { validateShopProductImage } from "@/lib/shop/product-image";
import styles from "@/components/shop/shop.module.css";

type CategoryOption = { id: string; name: string };
type ProductInitial = {
  id: string;
  variantId: string;
  categoryId: string;
  type: "IN_GAME" | "PROMOTIONAL";
  title: string;
  slug: string;
  sku: string;
  variantName: string;
  price: string;
  stockMode: "FINITE" | "UNLIMITED";
  stockQuantity: number;
  estimatedMinutes: number;
  maxPerOrder: number;
  imageUrl: string;
  shortDescription: string;
  description: string;
  fulfillmentTerms: string;
  isActive: boolean;
  isFeatured: boolean;
  isPopular: boolean;
};

export function ShopProductForm({ categories, initial }: { categories: CategoryOption[]; initial?: ProductInitial }) {
  const inputId = useId();
  const [unlimited, setUnlimited] = useState(initial?.stockMode === "UNLIMITED");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const editing = Boolean(initial);

  async function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validateShopProductImage(file);
    if (validationError) {
      setUploadError(validationError);
      event.target.value = "";
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      setImageUrl(await uploadFile(file, "shop-products"));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Не удалось загрузить изображение.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return <form action="/api/admin/shop" method="post" className={`${styles.adminCard} ${styles.adminForm}`}>
    <input type="hidden" name="_action" value={editing ? "updateProduct" : "createProduct"} />
    {initial ? <><input type="hidden" name="id" value={initial.id} /><input type="hidden" name="variantId" value={initial.variantId} /></> : null}
    <input type="hidden" name="imageUrl" value={imageUrl} />

    <div className={styles.adminCardHead}>
      <div><p className={styles.eyebrow}>{editing ? "Редактирование" : "Новый товар"}</p><h2>{editing ? initial?.title : "Создать товар"}</h2></div>
      {editing ? <Save aria-hidden="true" /> : <PackagePlus aria-hidden="true" />}
    </div>

    <label className={styles.uploadFrame} htmlFor={inputId}>
      {imageUrl ? <Image src={imageUrl} alt="Предпросмотр изображения товара" fill unoptimized sizes="(max-width: 720px) 100vw, 520px" /> : <span className={styles.uploadEmpty}><ImagePlus /><strong>Загрузить изображение</strong><small>Рекомендуемый размер: 1600 × 1000 px, пропорции 16:10<br />JPG, PNG, WebP или AVIF · до 12 MB</small></span>}
      <span className={styles.uploadAction}>{uploading ? <><Loader2 className={styles.spin} /> Загрузка…</> : imageUrl ? "Заменить изображение" : "Выбрать файл"}</span>
      <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={onImageChange} disabled={uploading} />
    </label>
    {uploadError ? <p className={styles.fieldError}>{uploadError}</p> : null}

    <div className={styles.formRow}>
      <label className={styles.fieldLabel}>Категория<select className={styles.select} name="categoryId" required defaultValue={initial?.categoryId}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><small className={styles.helper}>Раздел каталога, в котором покупатель увидит товар.</small></label>
      <label className={styles.fieldLabel}>Тип товара<select className={styles.select} name="type" defaultValue={initial?.type ?? "IN_GAME"}><option value="IN_GAME">Внутриигровой</option><option value="PROMOTIONAL">Акционный</option></select><small className={styles.helper}>Тип используется в фильтрах каталога.</small></label>
    </div>

    <div className={styles.formRow}>
      <label className={styles.fieldLabel}>Название<input className={styles.input} name="title" required defaultValue={initial?.title} placeholder="Например: 1 050 игровых монет" /><small className={styles.helper}>Главное название на карточке и странице товара.</small></label>
      <label className={styles.fieldLabel}>Slug<input className={styles.input} name="slug" required pattern="[a-z0-9-]+" defaultValue={initial?.slug} placeholder="1050-coins" /><small className={styles.helper}>Часть адреса после /shop/. Только латиница, цифры и дефисы.</small></label>
    </div>

    <div className={styles.formRow}>
      <label className={styles.fieldLabel}>SKU<input className={styles.input} name="sku" required defaultValue={initial?.sku} placeholder="COINS-1050" /><small className={styles.helper}>Уникальный внутренний код варианта для учёта и заказов.</small></label>
      <label className={styles.fieldLabel}>Название варианта<input className={styles.input} name="variantName" defaultValue={initial?.variantName ?? "Стандартный"} /><small className={styles.helper}>Например «Стандартный» или «Для Android».</small></label>
    </div>

    <div className={styles.formRow}>
      <label className={styles.fieldLabel}>Цена, ₽<input className={styles.input} name="price" required inputMode="decimal" defaultValue={initial?.price} placeholder="1490" /><small className={styles.helper}>Итог всегда пересчитывается сервером.</small></label>
      <label className={styles.fieldLabel}>Время выполнения, мин<input className={styles.input} name="estimatedMinutes" type="number" min="1" max="10080" defaultValue={initial?.estimatedMinutes ?? 30} /><small className={styles.helper}>Ориентир, который увидит покупатель до оплаты.</small></label>
    </div>

    <div className={styles.formRow}>
      {!unlimited ? <label className={styles.fieldLabel}>Остаток<input className={styles.input} name="stockQuantity" type="number" min="0" defaultValue={initial?.stockQuantity ?? 0} /><small className={styles.helper}>Сколько единиц сейчас доступно для продажи.</small></label> : <input type="hidden" name="stockQuantity" value="0" />}
      <label className={styles.fieldLabel}>Максимум в заказе<input className={styles.input} name="maxPerOrder" type="number" min="1" max="99" defaultValue={initial?.maxPerOrder ?? 10} /><small className={styles.helper}>Ограничение количества для одного покупателя за заказ.</small></label>
    </div>

    <div className={styles.switchGrid}>
      <label className={styles.checkLabel}><input type="checkbox" name="unlimited" value="true" checked={unlimited} onChange={(event) => setUnlimited(event.target.checked)} /> Неограниченный остаток<span className={styles.helper}>Количество не показывается и не уменьшается.</span></label>
      <label className={styles.checkLabel}><input type="checkbox" name="isActive" value="true" defaultChecked={initial?.isActive} /> Опубликовать<span className={styles.helper}>Товар станет виден в каталоге.</span></label>
      <label className={styles.checkLabel}><input type="checkbox" name="isFeatured" value="true" defaultChecked={initial?.isFeatured} /> Рекомендуемый<span className={styles.helper}>Можно выделять в подборках магазина.</span></label>
      <label className={styles.checkLabel}><input type="checkbox" name="isPopular" value="true" defaultChecked={initial?.isPopular} /> Популярный<span className={styles.helper}>Попадает в популярную сортировку и блок на главной.</span></label>
    </div>

    <label className={styles.fieldLabel}>Краткое описание<input className={styles.input} name="shortDescription" required defaultValue={initial?.shortDescription} placeholder="Что покупатель получает и для какой платформы" /><small className={styles.helper}>Одна короткая строка для карточки товара — без подробных условий.</small></label>
    <label className={styles.fieldLabel}>Полное описание<textarea className={styles.textarea} name="description" required defaultValue={initial?.description} placeholder="Подробно опишите состав товара, ограничения и совместимость" /><small className={styles.helper}>Показывается на странице товара. Объясните содержание простыми словами.</small></label>
    <label className={styles.fieldLabel}>Условия получения<textarea className={styles.textarea} name="fulfillmentTerms" required defaultValue={initial?.fulfillmentTerms} placeholder="Какие данные нужны, как проходит выполнение и что нельзя передавать" /><small className={styles.helper}>Пошагово объясните получение. Не запрашивайте пароль, OTP, токен или доступ к аккаунту.</small></label>

    <button className={styles.button} type="submit" disabled={uploading}>{editing ? <><Save /> Сохранить товар</> : <><PackagePlus /> Создать товар</>}</button>
  </form>;
}
