"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, LockKeyhole, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatShopMoney } from "@/lib/shop/format";
import styles from "./shop.module.css";

type Variant = {
  id: string;
  name: string;
  sku: string;
  priceMinor: number;
  available: boolean;
  availableQuantity: number | null;
  estimatedMinutes: number | null;
  maxPerOrder: number;
  quantityEnabled: boolean;
  activePromotion: null | { salePriceMinor: number; discountMinor: number };
};

type ProductField = {
  key: string;
  label: string;
  description: string | null;
  placeholder: string | null;
  type: string;
  isRequired: boolean;
  isSensitive: boolean;
  options: string[];
};


export function CheckoutSheet(props: {
  productId: string;
  productTitle: string;
  variants: Variant[];
  fields: ProductField[];
  termsVersion: string;
  currency: string;
  authenticated: boolean;
  telegramLinked: boolean;
  shopAvailable: boolean;
  payment: { configured: boolean; reason: string };
}) {
  const defaultVariant = props.variants.find((variant) => variant.available) ?? props.variants[0];
  const [open, setOpen] = useState(false);
  const [variantId, setVariantId] = useState(defaultVariant?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [promoCode, setPromoCode] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const selected = props.variants.find((variant) => variant.id === variantId) ?? defaultVariant;
  const draftKey = useMemo(() => `shop-checkout:${props.productId}`, [props.productId]);

  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) ?? "null") as { variantId?: string; quantity?: number; promoCode?: string; values?: Record<string, string> } | null;
      if (!draft) return;
      if (draft.variantId && props.variants.some((variant) => variant.id === draft.variantId)) setVariantId(draft.variantId);
      if (draft.quantity) setQuantity(draft.quantity);
      if (draft.promoCode) setPromoCode(draft.promoCode);
      if (draft.values) setValues(draft.values);
    } catch {}
  }, [draftKey, props.variants]);

  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify({ variantId, quantity, promoCode, values }));
  }, [draftKey, promoCode, quantity, values, variantId]);

  const payload = () => ({ variantId, quantity, promoCode: promoCode || undefined, fields: values, termsAccepted: accepted, termsVersion: props.termsVersion });

  async function createOrder() {
    setLoading(true);
    try {
      const response = await fetch("/api/shop/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось создать заказ.");
      localStorage.removeItem(draftKey);
      toast.success(`Заказ ${data.order.orderNumber} создан`);
      window.location.assign(data.payment.checkoutUrl || `/shop/orders/${data.order.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось создать заказ.");
    } finally { setLoading(false); }
  }

  if (!props.authenticated) return <Link className={styles.button} href={`/login?callbackUrl=${encodeURIComponent(`/shop`)}`}><ShoppingBag size={17} /> Войти и купить</Link>;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild><button className={styles.button} type="button" disabled={!props.shopAvailable || !selected?.available}><ShoppingBag size={17} />{selected?.available ? "Купить" : "Нет в наличии"}</button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.sheetOverlay} />
        <Dialog.Content className={styles.sheet} onOpenAutoFocus={(event) => event.preventDefault()}>
          <div className={styles.sheetHead}><div><p className={styles.eyebrow}>Проверка перед оплатой</p><Dialog.Title>Оформление заказа</Dialog.Title></div><Dialog.Close className={styles.iconButton} aria-label="Закрыть"><X /></Dialog.Close></div>
          {!props.telegramLinked ? <div className={styles.warning}><LockKeyhole /><div><strong>Сначала привяжите Telegram</strong><br />Черновик сохранится на этом устройстве. <Link href="/dashboard/security">Перейти к привязке</Link>.</div></div> : null}
          {!props.payment.configured ? <div className={styles.notice}><LockKeyhole /><div><strong>Оплата ещё не подключена</strong><br />{props.payment.reason}</div></div> : null}
          <div className={styles.form}>
            <label className={styles.fieldLabel}>Вариант товара
              <div className={styles.variantList}>{props.variants.map((variant) => {
                const price = variant.activePromotion?.salePriceMinor ?? variant.priceMinor;
                return <label key={variant.id} className={styles.variantOption}><input type="radio" name="variant" value={variant.id} checked={variantId === variant.id} disabled={!variant.available} onChange={() => setVariantId(variant.id)} /><span><strong>{variant.name}</strong><small>{variant.available ? variant.availableQuantity === null ? "Без ограничения" : `Осталось: ${variant.availableQuantity}` : "Нет в наличии"}</small></span><strong>{formatShopMoney(price, props.currency)}</strong></label>;
              })}</div>
            </label>
            <div className={styles.formRow}>
              {selected?.quantityEnabled ? <label className={styles.fieldLabel}>Количество<input className={styles.input} type="number" min={1} max={Math.min(99, selected.maxPerOrder, selected.availableQuantity ?? 99)} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} /></label> : null}
              <label className={styles.fieldLabel}>Промокод<input className={styles.input} value={promoCode} onChange={(event) => setPromoCode(event.target.value.toUpperCase())} placeholder="Если есть" /></label>
            </div>
            {props.fields.map((field) => <label key={field.key} className={styles.fieldLabel}>{field.label}{field.type === "SELECT" ? (
              <select className={styles.select} required={field.isRequired} value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}><option value="">Выберите</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
            ) : field.type === "TEXTAREA" ? (
              <textarea className={styles.textarea} required={field.isRequired} value={values[field.key] ?? ""} placeholder={field.placeholder ?? undefined} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} />
            ) : (
              <input className={styles.input} type={field.type === "NUMBER" ? "number" : field.type === "TIME" ? "time" : "text"} required={field.isRequired} value={values[field.key] ?? ""} placeholder={field.placeholder ?? undefined} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} />
            )}<span className={styles.helper}>{field.description}{field.isSensitive ? " Данные будут зашифрованы." : ""}</span></label>)}
            <div className={styles.legalConfirmCard}><div className={styles.legalConfirmTitle}><Check size={16} /> Проверьте заказ перед оплатой</div><p>Нажимая кнопку оплаты, вы подтверждаете, что проверили товар, данные, количество и итоговую сумму.</p><label className={styles.checkLabel}><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /> Я принимаю <Link href="/shop/legal/terms" target="_blank">условия покупки</Link>, <Link href="/shop/legal/rules" target="_blank">правила магазина</Link>, <Link href="/shop/legal/refunds" target="_blank">правила возврата</Link> и <Link href="/shop/legal/data" target="_blank">обработку данных</Link>.</label></div>
            <button className={styles.button} type="button" disabled={loading || !accepted || !props.telegramLinked || !props.payment.configured} onClick={createOrder}><Check size={17} />{loading ? "Создаём…" : "Оплатить заказ"}</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
