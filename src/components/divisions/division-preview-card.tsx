import Link from "next/link";
import { Lock, Sparkles, Swords } from "lucide-react";
import { cn } from "@/lib/utils";

export function DivisionPreviewCard({ canOpen }: { canOpen: boolean }) {
  const content = (
    <div
      className={cn(
        "group relative min-h-[260px] overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(250,204,21,0.18),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(56,189,248,0.16),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.86),rgba(3,7,18,0.92))] p-5 shadow-[0_24px_70px_rgba(2,6,23,0.34)] transition duration-300",
        canOpen ? "hover:-translate-y-1 hover:border-amber-200/25 hover:shadow-[0_28px_80px_rgba(245,158,11,0.12)]" : "cursor-not-allowed",
      )}
    >
      <div className={cn("absolute inset-0 transition", !canOpen && "backdrop-blur-[5px]")} />
      {!canOpen ? <div className="absolute inset-0 z-10 bg-black/28" /> : null}

      <div className="relative z-20 flex h-full min-h-[220px] flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-amber-100">Beta</span>
            <span className="rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-1 text-xs font-bold text-sky-100">Testing</span>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-amber-100">
            {canOpen ? <Swords className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-primary">
            <Sparkles className="h-4 w-4" />
            Новый формат
          </div>
          <div>
            <h2 className="font-display text-4xl font-thin text-white">Дивизион</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
              5 дивизионов, матчмейкинг, очки, рейтинг и спорные матчи. Режим находится в beta testing.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-4">
          {["5 дивизионов", "24 часа на матч", "Рейтинг Elo"].map((item) => (
            <span key={item} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-zinc-300">
              {item}
            </span>
          ))}
        </div>

        {!canOpen ? (
          <div className="absolute inset-x-4 top-1/2 z-30 -translate-y-1/2 rounded-2xl border border-white/10 bg-black/55 p-4 text-center shadow-2xl backdrop-blur-xl">
            <div className="text-sm font-bold text-white">Скоро для всех игроков</div>
            <div className="mt-1 text-xs leading-5 text-zinc-400">Пока режим создается, открыть его могут только администраторы.</div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return canOpen ? <Link href="/divisions">{content}</Link> : content;
}
