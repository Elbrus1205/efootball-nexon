"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { clearVkIntent, exchangeVkCode, readVkIntent } from "@/lib/vkid-client";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";

async function waitForAuthenticatedSession(timeoutMs = 8000, intervalMs = 250) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const session = await getSession().catch(() => null);
    if (session?.user?.id) {
      return session;
    }

    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }

  return null;
}

function normalizeVkRedirectUrl(url?: string | null) {
  if (!url) return "/dashboard";

  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.hostname.toLowerCase() === "www.efootball-nexon.com") {
      parsed.hostname = "efootball-nexon.com";
    }

    if (parsed.origin === window.location.origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

export default function VkCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const code = searchParams.get("code");
    const deviceId = searchParams.get("device_id");
    const intent = readVkIntent();

    if (!code || !deviceId) {
      clearVkIntent();
      toast.error("VK не вернул код авторизации.");
      router.replace("/login");
      return;
    }

    const finish = async () => {
      try {
        const token = await exchangeVkCode(code, deviceId, intent);

        if (intent?.mode === "bind") {
          const response = await fetch("/api/security/connections/vk", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              accessToken: token.access_token,
            }),
          });

          const payload = await response.json().catch(() => null);

          if (!response.ok) {
            throw new Error(payload?.error || "Не удалось привязать VK.");
          }

          clearVkIntent();
          toast.success(payload?.message || "VK успешно привязан.");
          window.location.replace(intent.callbackUrl || "/dashboard/security");
          return;
        }

        const result = await signIn("vkid", {
          accessToken: token.access_token,
          legalAccepted: intent?.legalAccepted ? "true" : "false",
          callbackUrl: intent?.callbackUrl || "/dashboard",
          fingerprint: await getDeviceFingerprint(),
          redirect: false,
        });

        if (!result || result.error) {
          throw new Error("Не удалось войти через VK.");
        }

        const session = await waitForAuthenticatedSession();
        if (!session?.user?.id) {
          throw new Error("Сессия VK создана, но сайт не успел её применить. Попробуйте ещё раз.");
        }

        clearVkIntent();
        toast.success("Вход через VK выполнен.");
        window.location.replace(normalizeVkRedirectUrl(intent?.callbackUrl || result.url || "/dashboard"));
      } catch (error) {
        console.error("VK callback error", error);
        clearVkIntent();
        const message = error instanceof Error ? error.message : "VK вход завершился ошибкой.";
        toast.error(message);
        router.replace(intent?.mode === "bind" ? "/dashboard/security" : "/login");
      }
    };

    void finish();
  }, [router, searchParams]);

  return (
    <div className="page-shell flex min-h-[60vh] items-center justify-center py-10">
      <Card className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#11151d] p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-blue-400/20 bg-blue-500/10 text-blue-300">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-white">Подключаем VK</h1>
          <p className="text-sm leading-6 text-zinc-400">Завершаем авторизацию и возвращаем вас в аккаунт.</p>
        </div>
      </Card>
    </div>
  );
}
