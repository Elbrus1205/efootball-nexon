"use client";

import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function TournamentError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page-shell">
      <Card className="mx-auto flex min-h-80 max-w-2xl flex-col items-center justify-center p-6 text-center sm:p-10">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-300/20 bg-rose-400/10 text-rose-200"><AlertTriangle className="h-6 w-6" /></span>
        <h1 className="mt-5 text-2xl font-bold text-white">Не удалось открыть турнир</h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">Попробуйте загрузить страницу ещё раз. Если ошибка повторится, вернитесь к списку турниров.</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button onClick={reset} className="gap-2"><RotateCcw className="h-4 w-4" />Повторить</Button>
          <Button asChild variant="secondary" className="gap-2"><Link href="/tournaments"><ArrowLeft className="h-4 w-4" />Все турниры</Link></Button>
        </div>
      </Card>
    </div>
  );
}
