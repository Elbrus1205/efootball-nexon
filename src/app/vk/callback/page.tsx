"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { clearVkIntent, exchangeVkCode, readVkIntent } from "@/lib/vkid-client";

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
        const token = await exchangeVkCode(code, deviceId);

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
          router.replace(intent.callbackUrl || "/dashboard/security");
          router.refresh();
          return;
        }

        const result = await signIn("vkid", {
          accessToken: token.access_token,
          redirect: false,
        });

        if (!result || result.error) {
          throw new Error("Не удалось войти через VK.");
        }

        clearVkIntent();
        toast.success("Вход через VK выполнен.");
        router.replace(intent?.callbackUrl || "/dashboard");
        router.refresh();
      } catch (error) {
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
          <p className="text-sm leading-6 text-zinc-400">
            Завершаем авторизацию и возвращаем вас в аккаунт.
          </p>
        </div>
      </Card>
    </div>
  );
}
