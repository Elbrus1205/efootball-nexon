"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [mobile, setMobile] = useState(false);
  const activeCount = [props.values.category, props.values.type, props.values.min, props.values.max, props.values.available, props.values.discounted].filter(Boolean).length;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const update = () => setMobile(media.matches);
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

  return (
    <>
      <button type="button" className={`${styles.buttonSecondary} ${styles.mobileFilterButton}`} aria-label="Открыть фильтры" onClick={() => setOpen(true)}><SlidersHorizontal aria-hidden="true" /><span>Фильтры</span>{activeCount ? <b>{activeCount}</b> : null}</button>
      {open ? (
        <>
          <button type="button" className={styles.sheetOverlay} aria-label="Закрыть фильтры" onClick={() => setOpen(false)} />
          <div className={`${styles.sheet} ${styles.filterSheet}`} role="dialog" aria-modal="true" aria-label="Фильтры каталога">
            <div className={styles.sheetHead}><div><p className={styles.eyebrow}>Каталог</p><h2>Фильтры</h2></div><button type="button" className={styles.iconButton} aria-label="Закрыть" onClick={() => setOpen(false)}><X /></button></div>
            <div className={styles.form}><FilterFields {...props} /><button className={styles.button} type="submit">Показать товары</button></div>
          </div>
        </>
      ) : null}
    </>
  );
}
