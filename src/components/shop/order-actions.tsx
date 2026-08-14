"use client";

import { AlertTriangle, CheckCircle2, Clock3, MessageSquareText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import styles from "./shop.module.css";

export function OrderActions(props: {
  orderId: string;
  status: string;
  isBuyer: boolean;
  canComplete: boolean;
  complaintExpiresAt: string | null;
  hasDispute: boolean;
  reviewsUrl: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const complaintOpen = Boolean(props.complaintExpiresAt && new Date(props.complaintExpiresAt).getTime() > Date.now());

  async function openComplaint() {
    if (!window.confirm("Отправить жалобу в поддержку? Выполнение заказа и выплата будут приостановлены до проверки.")) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/shop/orders/${props.orderId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "OPEN_DISPUTE", reason: "OTHER", comment: "Покупатель сообщил о проблеме с выполнением заказа." }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Жалоба не отправлена.");
      toast.success("Жалоба отправлена в поддержку");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Жалоба не отправлена.");
    } finally {
      setLoading(false);
    }
  }

  async function completeOrder() {
    if (!window.confirm("Подтвердить, что заказ полностью выполнен? Покупатель сразу получит уведомление и ссылку на отзывы.")) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/shop/orders/${props.orderId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SELLER_COMPLETE" }),
      });
      const data: { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось завершить заказ.");
      toast.success("Заказ отмечен выполненным");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось завершить заказ.");
    } finally {
      setLoading(false);
    }
  }

  if (props.canComplete && props.status === "IN_PROGRESS" && !props.hasDispute) {
    return <div className={styles.complaintBar}><div><CheckCircle2 /><span>После полного выполнения нажмите кнопку. Покупатель сразу получит уведомление и ссылку на отзывы.</span></div><button className={styles.button} type="button" disabled={loading} onClick={completeOrder}><CheckCircle2 /> Заказ выполнен</button></div>;
  }
  if (props.isBuyer && props.status === "WAITING_BUYER_CONFIRMATION" && props.reviewsUrl) {
    return <div className={styles.complaintBar}><div><MessageSquareText /><span>Заказ выполнен. Оставьте отзыв в Telegram или сообщите о проблеме, пока действует 48-часовая защита.</span></div><div className={styles.actionGroup}><a className={styles.button} href={props.reviewsUrl} target="_blank" rel="noreferrer"><MessageSquareText /> Оставить отзыв</a>{complaintOpen && !props.hasDispute ? <button className={styles.buttonDanger} type="button" disabled={loading} onClick={openComplaint}><AlertTriangle /> Пожаловаться</button> : null}</div></div>;
  }
  if (props.isBuyer && props.status === "COMPLETED" && props.reviewsUrl) {
    return <div className={styles.complaintBar}><div><MessageSquareText /><span>Заказ выполнен. Оставьте отзыв в комментариях к посту Telegram.</span></div><a className={styles.button} href={props.reviewsUrl} target="_blank" rel="noreferrer"><MessageSquareText /> Оставить отзыв</a></div>;
  }
  if (!props.isBuyer || props.status !== "IN_PROGRESS" || props.hasDispute) return null;
  return complaintOpen ? <div className={styles.complaintBar}><div><Clock3 /><span>Заказ защищён 48 часов после оплаты. Если возникла проблема, сразу сообщите поддержке.</span></div><button className={styles.buttonDanger} type="button" disabled={loading} onClick={openComplaint}><AlertTriangle /> Пожаловаться</button></div> : null;
}
