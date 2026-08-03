"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import styles from "./shop.module.css";

type Props = {
  categories: Array<{ slug: string; name: string }>;
  values: Record<string, string | undefined>;
};

function FilterFields({ categories, values }: Props) {
  return (
    <>
      <label className={styles.filterLabel}>Категория
        <select className={styles.select} name="category" defaultValue={values.category ?? ""}>
          <option value="">Все категории</option>
          {categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
        </select>
      </label>
      <label className={styles.filterLabel}>Тип
        <select className={styles.select} name="type" defaultValue={values.type ?? ""}>
          <option value="">Все</option><option value="IN_GAME">Внутриигровой</option><option value="PROMOTIONAL">Акционный</option>
        </select>
      </label>
      <label className={styles.filterLabel}>Цена от
        <input className={styles.input} name="min" inputMode="decimal" defaultValue={values.min} placeholder="0 ₽" />
      </label>
      <label className={styles.filterLabel}>Цена до
        <input className={styles.input} name="max" inputMode="decimal" defaultValue={values.max} placeholder="Без лимита" />
      </label>
      <div style={{ display: "grid", gap: ".4rem" }}>
        <label className={styles.checkLabel}><input type="checkbox" name="available" value="1" defaultChecked={values.available === "1"} /> В наличии</label>
        <label className={styles.checkLabel}><input type="checkbox" name="discounted" value="1" defaultChecked={values.discounted === "1"} /> Со скидкой</label>
      </div>
    </>
  );
}

export function CatalogFilters(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`${styles.buttonSecondary} ${styles.mobileFilterButton}`} aria-label="Открыть фильтры" onClick={() => setOpen(true)}><SlidersHorizontal aria-hidden="true" /></button>
      <div className={styles.filters}><FilterFields {...props} /></div>
      {open ? (
        <>
          <button type="button" className={styles.sheetOverlay} aria-label="Закрыть фильтры" onClick={() => setOpen(false)} />
          <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Фильтры каталога">
            <div className={styles.sheetHead}><div><p className={styles.eyebrow}>Каталог</p><h2>Фильтры</h2></div><button type="button" className={styles.iconButton} aria-label="Закрыть" onClick={() => setOpen(false)}><X /></button></div>
            <div className={styles.form}><FilterFields {...props} /><button className={styles.button} type="submit">Показать товары</button></div>
          </div>
        </>
      ) : null}
    </>
  );
}
