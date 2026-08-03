"use client";

import { AlertTriangle, Check, MessageSquareText, Play, Send, ShoppingBag, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  const [message, setMessage] = useState("");
  const [review, setReview] = useState({ rating: 5, body: "" });

  async function action(name: string, extra: Record<string, unknown> = {}) {
    setLoading(name);
    try {
      const response = await fetch(`/api/shop/orders/${props.orderId}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, ...extra }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Действие не выполнено.");
      toast.success("Статус заказа обновлён");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Действие не выполнено."); }
    finally { setLoading(null); }
  }

  async function sendMessage() {
    if (!message.trim()) return;
    setLoading("MESSAGE");
    try {
      const response = await fetch(`/api/shop/orders/${props.orderId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: message }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Сообщение не отправлено.");
      setMessage(""); toast.success("Сообщение отправлено"); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Сообщение не отправлено."); }
    finally { setLoading(null); }
  }

  async function submitReview() {
    setLoading("REVIEW");
    try {
      const response = await fetch(`/api/shop/orders/${props.orderId}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating: review.rating, body: review.body, tags: [], mediaUrls: [] }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Отзыв не опубликован.");
      toast.success(data.review.status === "PUBLISHED" ? "Отзыв опубликован" : "Отзыв отправлен на модерацию"); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Отзыв не опубликован."); }
    finally { setLoading(null); }
  }

  return <div className={styles.form}>
    <div className={styles.inlineActions}>
      {props.isSeller && props.status === "WAITING_SELLER" ? <button className={styles.button} disabled={Boolean(loading)} onClick={() => action("ACCEPT")}><ShoppingBag size={16} /> Принять заказ</button> : null}
      {props.isSeller && props.status === "ACCEPTED" ? <button className={styles.button} disabled={Boolean(loading)} onClick={() => action("START")}><Play size={16} /> Начать выполнение</button> : null}
      {props.isSeller && props.status === "IN_PROGRESS" ? <button className={styles.button} disabled={Boolean(loading)} onClick={() => action("SELLER_COMPLETE")}><Check size={16} /> Заказ выполнен</button> : null}
      {props.isBuyer && props.status === "WAITING_BUYER_CONFIRMATION" ? <button className={styles.button} disabled={Boolean(loading)} onClick={() => action("BUYER_CONFIRM")}><Check size={16} /> Подтвердить получение</button> : null}
      {(props.isBuyer || props.isSeller) && ["ACCEPTED", "IN_PROGRESS", "SELLER_COMPLETED", "WAITING_BUYER_CONFIRMATION"].includes(props.status) ? <button className={styles.buttonDanger} disabled={Boolean(loading)} onClick={() => action("OPEN_DISPUTE", { reason: "OTHER", comment: "Требуется помощь с заказом." })}><AlertTriangle size={16} /> Есть проблема</button> : null}
      {props.isBuyer && props.status === "PENDING_PAYMENT" ? <button className={styles.buttonDanger} disabled={Boolean(loading)} onClick={() => action("CANCEL")}><XCircle size={16} /> Отменить</button> : null}
    </div>

    {(props.isBuyer || props.isSeller || props.canSupport) ? <div className={styles.formRow}><label className={styles.fieldLabel}>Сообщение по заказу<textarea className={styles.textarea} value={message} maxLength={2000} onChange={(event) => setMessage(event.target.value)} placeholder="Опишите вопрос без паролей и платёжных данных" /></label><div style={{ display: "flex", alignItems: "end" }}><button className={styles.buttonSecondary} type="button" disabled={loading === "MESSAGE" || !message.trim()} onClick={sendMessage}><Send size={16} /> Отправить</button></div></div> : null}

    {props.isBuyer && props.status === "COMPLETED" && !props.hasReview ? <div className={styles.summary}><strong><MessageSquareText size={16} /> Оставить отзыв</strong><div className={styles.formRow}><label className={styles.fieldLabel}>Оценка<select className={styles.select} value={review.rating} onChange={(event) => setReview((current) => ({ ...current, rating: Number(event.target.value) }))}>{[5,4,3,2,1].map((rating) => <option value={rating} key={rating}>{rating} из 5</option>)}</select></label><label className={styles.fieldLabel}>Текст<input className={styles.input} value={review.body} minLength={3} maxLength={2000} onChange={(event) => setReview((current) => ({ ...current, body: event.target.value }))} /></label></div><button className={styles.button} type="button" disabled={loading === "REVIEW" || review.body.trim().length < 3} onClick={submitReview}>Опубликовать отзыв</button></div> : null}
  </div>;
}
