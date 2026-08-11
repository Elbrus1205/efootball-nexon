"use client";

import { AlertTriangle, Check, Play, ShoppingBag, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import styles from "./shop.module.css";

export function OrderActions(props: {
  orderId: string;
  status: string;
  isBuyer: boolean;
  isSeller: boolean;
  canSupport: boolean;
  hasReview: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(props.status);
  const [review, setReview] = useState({ rating: 5, body: "" });

  useEffect(() => {
    setCurrentStatus(props.status);
  }, [props.status]);

  async function action(name: string, extra: Record<string, unknown> = {}) {
    setLoading(name);
    try {
      const response = await fetch(`/api/shop/orders/${props.orderId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: name, ...extra }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Действие не выполнено.");
      setCurrentStatus(data.order.status);
      toast.success(name === "BUYER_CONFIRM" ? "Получение подтверждено — теперь оставьте отзыв" : "Статус заказа обновлён");
      router.refresh();
      if (name === "BUYER_CONFIRM") {
        requestAnimationFrame(() => document.getElementById("review")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Действие не выполнено.");
    } finally {
      setLoading(null);
    }
  }

  async function submitReview() {
    setLoading("REVIEW");
    try {
      const response = await fetch(`/api/shop/orders/${props.orderId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: review.rating, body: review.body, tags: [], mediaUrls: [] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Отзыв не опубликован.");
      toast.success(data.review.status === "PUBLISHED" ? "Спасибо! Отзыв опубликован" : "Отзыв отправлен на модерацию");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Отзыв не опубликован.");
    } finally {
      setLoading(null);
    }
  }

  return <div className={styles.form}>
    <div className={styles.inlineActions}>
      {props.isSeller && currentStatus === "WAITING_SELLER" ? <button className={styles.button} disabled={Boolean(loading)} onClick={() => action("ACCEPT")}><ShoppingBag size={16} /> Взяться за работу</button> : null}
      {props.isSeller && currentStatus === "ACCEPTED" ? <button className={styles.button} disabled={Boolean(loading)} onClick={() => action("START")}><Play size={16} /> Начать выполнение</button> : null}
      {props.isSeller && currentStatus === "IN_PROGRESS" ? <button className={styles.button} disabled={Boolean(loading)} onClick={() => action("SELLER_COMPLETE")}><Check size={16} /> Монеты куплены</button> : null}
      {props.isBuyer && currentStatus === "WAITING_BUYER_CONFIRMATION" ? <button className={styles.button} disabled={Boolean(loading)} onClick={() => action("BUYER_CONFIRM")}><Check size={16} /> Подтвердить получение</button> : null}
      {(props.isBuyer || props.isSeller) && ["ACCEPTED", "IN_PROGRESS", "SELLER_COMPLETED", "WAITING_BUYER_CONFIRMATION"].includes(currentStatus) ? <button className={styles.buttonDanger} disabled={Boolean(loading)} onClick={() => action("OPEN_DISPUTE", { reason: "OTHER", comment: "Требуется помощь с заказом." })}><AlertTriangle size={16} /> Есть проблема</button> : null}
    </div>

    {props.isBuyer && currentStatus === "COMPLETED" && !props.hasReview ? <section className={styles.reviewComposer} id="review"><div><p className={styles.eyebrow}>Заказ успешно завершён</p><h2>Как всё прошло?</h2><p>Поставьте оценку исполнителю и расскажите другим игрокам о покупке.</p></div><div className={styles.starPicker} role="radiogroup" aria-label="Оценка заказа">{[1,2,3,4,5].map((rating) => <button key={rating} type="button" aria-label={`${rating} из 5`} aria-pressed={review.rating === rating} onClick={() => setReview((current) => ({ ...current, rating }))}><Star fill={rating <= review.rating ? "currentColor" : "none"} /></button>)}</div><textarea className={styles.textarea} value={review.body} minLength={3} maxLength={2000} placeholder="Напишите несколько слов о скорости и результате" onChange={(event) => setReview((current) => ({ ...current, body: event.target.value }))} /><button className={styles.button} type="button" disabled={loading === "REVIEW" || review.body.trim().length < 3} onClick={submitReview}>Опубликовать отзыв</button></section> : null}
  </div>;
}
