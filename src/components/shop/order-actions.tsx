"use client";

import { AlertTriangle, Clock3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import styles from "./shop.module.css";

export function OrderActions(props: {
  orderId: string;
  status: string;
  isBuyer: boolean;
  complaintExpiresAt: string | null;
  hasDispute: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const complaintOpen = Boolean(props.complaintExpiresAt && new Date(props.complaintExpiresAt).getTime() > Date.now());

  async function openComplaint() {
    if (!window.confirm("Отправить жалобу в по��держку? Выполнение заказа и выплата будут приостановлены до проверки.")) return;
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

  if (!props.isBuyer || props.status !== "IN_PROGRESS" || props.hasDispute) return null;
  return complaintOpen ? <div className={styles.complaintBar}><div><Clock3 /><span>Заказ защищён 48 часов после оплаты. Если возникла проблема, сразу сообщите поддержке.</span></div><button className={styles.buttonDanger} type="button" disabled={loading} onClick={openComplaint}><AlertTriangle /> Пожаловаться</button></div> : null;
}
