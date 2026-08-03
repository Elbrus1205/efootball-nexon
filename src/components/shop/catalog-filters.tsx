"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./shop.module.css";

export const SHOP_CATALOG_FORM_ID = "shop-catalog-form";

type Props = {
  categories: Array<{ slug: string; name: string }>;
  values: Record<string, string | undefined>;
};

function FilterFields({ categories, values, formId }: Props & { formId?: string }) {
  return (
    <>
      <label className={styles.filterLabel}>Категория
        <select className={styles.select} name="category" form={formId} defaultValue={values.category ?? ""}>
          <option value="">Все категории</option>
          {categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
        </select>
      </label>
      <label className={styles.filterLabel}>Тип
        <select className={styles.select} name="type" form={formId} defaultValue={values.type ?? ""}>
          <option value="">Все</option><option value="IN_GAME">Внутриигровой</option><option value="PROMOTIONAL">Акционный</option>
        </select>
      </label>
      <label className={styles.filterLabel}>Цена от
        <input className={styles.input} name="min" form={formId} inputMode="decimal" defaultValue={values.min} placeholder="0 ₽" />
      </label>
      <label className={styles.filterLabel}>Цена до
        <input className={styles.input} name="max" form={formId} inputMode="decimal" defaultValue={values.max} placeholder="Без лимита" />
      </label>
      <div style={{ display: "grid", gap: ".4rem" }}>
        <label className={styles.checkLabel}><input type="checkbox" name="available" form={formId} value="1" defaultChecked={values.available === "1"} /> В наличии</label>
        <label className={styles.checkLabel}><input type="checkbox" name="discounted" form={formId} value="1" defaultChecked={values.discounted === "1"} /> Со скидкой</label>
      </div>
    </>
  );
}

export function CatalogFilters(props: Props) {
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const activeCount = [props.values.category, props.values.type, props.values.min, props.values.max, props.values.available, props.values.discounted].filter(Boolean).length;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const update = () => {
      setMobile(media.matches);
      if (!media.matches) setOpen(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  if (!mobile) return <div className={styles.filters}><FilterFields {...props} /></div>;

  const sheet = open ? createPortal(
    <>
      <button type="button" className={styles.sheetOverlay} aria-label="Закрыть фильтры" onClick={() => setOpen(false)} />
      <div className={`${styles.sheet} ${styles.filterSheet}`} role="dialog" aria-modal="true" aria-label="Фильтры каталога">
        <div className={styles.sheetHead}><div><p className={styles.eyebrow}>Каталог</p><h2>Фильтры</h2></div><button type="button" className={styles.iconButton} aria-label="Закрыть" onClick={() => setOpen(false)}><X /></button></div>
        <div className={styles.form}><FilterFields {...props} formId={SHOP_CATALOG_FORM_ID} /><button className={styles.button} type="submit" form={SHOP_CATALOG_FORM_ID}>Показать товары</button></div>
      </div>
    </>,
    document.body,
  ) : null;

  return (
    <>
      <button type="button" className={`${styles.buttonSecondary} ${styles.mobileFilterButton}`} aria-label="Открыть фильтры" onClick={() => setOpen(true)}><SlidersHorizontal aria-hidden="true" /><span>Фильтры</span>{activeCount ? <b>{activeCount}</b> : null}</button>
      {sheet}
    </>
  );
}
