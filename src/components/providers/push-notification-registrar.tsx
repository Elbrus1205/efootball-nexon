"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

function isInstalledApp() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function decodeApplicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function subscribeToPhoneNotifications(registration: ServiceWorkerRegistration) {
  const configResponse = await fetch("/api/push/subscriptions", { cache: "no-store" });
  if (!configResponse.ok) return;
  const config = (await configResponse.json()) as { publicKey?: string };
  if (!config.publicKey) return;

  const subscription = await registration.pushManager.getSubscription()
    ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeApplicationServerKey(config.publicKey),
    });
  const serialized = subscription.toJSON();
  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) return;

  await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: serialized.endpoint, keys: serialized.keys }),
  });
}

export function PushNotificationRegistrar() {
  const { status } = useSession();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    let removePermissionListener: (() => void) | null = null;

    const setup = async () => {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      if (cancelled) return;
      if (
        status !== "authenticated" ||
        !("PushManager" in window) ||
        !("Notification" in window) ||
        !isInstalledApp()
      ) return;

      if (Notification.permission === "granted") {
        await subscribeToPhoneNotifications(registration);
        return;
      }
      if (Notification.permission !== "default") return;

      const requestPermission = async () => {
        removePermissionListener?.();
        if (await Notification.requestPermission() === "granted") {
          await subscribeToPhoneNotifications(registration);
        }
      };
      document.addEventListener("pointerdown", requestPermission, { once: true });
      removePermissionListener = () => document.removeEventListener("pointerdown", requestPermission);
    };

    setup().catch((error) => console.error("Failed to register phone push notifications", error));
    return () => {
      cancelled = true;
      removePermissionListener?.();
    };
  }, [status]);

  return null;
}
