"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function RegulationsEditor({ initialText }: { initialText: string }) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      setMessage("Сохранение...");

      const response = await fetch("/api/admin/regulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });

      const result = await response.json().catch(() => ({
        error: "Не удалось обработать ответ сервера.",
      }));

      if (!response.ok) {
        setMessage(result.error ?? "Не удалось сохранить регламент.");
        return;
      }

      setMessage("Регламент сохранен и обновлен на публичной странице.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Напишите общий регламент платформы."
        className="min-h-[420px]"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-zinc-400">{message}</div>
        <Button onClick={save} disabled={isPending || text.trim().length < 20}>
          {isPending ? "Сохранение..." : "Сохранить регламент"}
        </Button>
      </div>
    </div>
  );
}
