import Link from "next/link";
import { Lock, Swords } from "lucide-react";
import { cn } from "@/lib/utils";

export function DivisionPreviewCard({ canOpen, coverImage }: { canOpen: boolean; coverImage?: string | null }) {
  const content = (
    <div
      className={cn(
        "group relative aspect-video overflow-hidden rounded-[26px] border border-white/10 bg-black shadow-[0_24px_70px_rgba(2,6,23,0.34)] transition duration-300",
        canOpen ? "hover:-translate-y-1 hover:border-amber-200/25 hover:shadow-[0_28px_80px_rgba(245,158,11,0.12)]" : "cursor-not-allowed",
      )}
    >
      {coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_62%_18%,rgba(255,255,255,0.95),transparent_15%),radial-gradient(circle_at_72%_46%,rgba(14,165,233,0.95),transparent_24%),radial-gradient(circle_at_34%_24%,rgba(168,85,247,0.7),transparent_22%),radial-gradient(circle_at_40%_78%,rgba(34,211,238,0.75),transparent_22%),linear-gradient(135deg,#050716_0%,#10104f_42%,#05040d_100%)]" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(0,0,0,0.2),rgba(0,0,0,0.02)_45%,rgba(0,0,0,0.42)),linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.72))]" />
      <div className="absolute inset-x-0 top-[38%] h-[21%] -skew-y-6 bg-white/80 blur-2xl" />
      <div className="absolute left-[8%] top-[8%] h-[70%] w-[84%] rounded-full border border-cyan-200/25 shadow-[0_0_42px_rgba(34,211,238,0.32)]" />
      <div className="absolute left-[18%] top-[18%] h-px w-[70%] rotate-[28deg] bg-cyan-200/70 shadow-[0_0_22px_4px_rgba(34,211,238,0.55)]" />
      <div className="absolute left-[8%] top-[54%] h-px w-[75%] -rotate-[14deg] bg-fuchsia-300/60 shadow-[0_0_18px_3px_rgba(217,70,239,0.45)]" />
      <div className={cn("absolute inset-0 transition", !canOpen && "backdrop-blur-[5px]")} />
      {!canOpen ? <div className="absolute inset-0 z-10 bg-black/28" /> : null}

      <div className="relative z-20 flex h-full flex-col justify-between p-4 sm:p-6 md:p-8">
        <div className="flex items-start justify-between gap-3">
          <div className="overflow-hidden rounded-sm border border-cyan-300 bg-[#171138]/95 shadow-[0_0_14px_rgba(34,211,238,0.55)]">
            <div className="bg-white/10 px-5 py-0.5 text-center text-[10px] font-black leading-none text-white sm:text-xs">Rank</div>
            <div className="px-3 pb-1 text-xl font-black leading-none text-yellow-300 sm:text-3xl">1-1,000,000</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/35 text-amber-100 backdrop-blur sm:h-12 sm:w-12">
            {canOpen ? <Swords className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </div>
        </div>

        <div className="absolute left-1/2 top-[22%] hidden w-[18%] min-w-[116px] max-w-[170px] -translate-x-1/2 rotate-[8deg] sm:block">
          <div className="aspect-[5/7] rounded-lg border-2 border-cyan-200 bg-[linear-gradient(145deg,#23104d,#6d28d9_42%,#111827)] p-2 shadow-[0_0_28px_rgba(34,211,238,0.9)]">
            <div className="flex items-start justify-between text-yellow-300">
              <div className="text-2xl font-black leading-none">98</div>
              <div className="rounded bg-white/10 px-1 text-[10px] font-black text-white">DIV</div>
            </div>
            <div className="mt-2 h-[48%] rounded bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.85),transparent_18%),linear-gradient(180deg,rgba(239,68,68,0.95),rgba(15,23,42,0.8))]" />
            <div className="mt-2 rounded bg-yellow-700/90 px-2 py-1 text-center text-[10px] font-black leading-tight text-white">eFootball Nexon</div>
            <div className="mt-2 flex justify-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-300" />
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-300" />
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-300" />
            </div>
          </div>
        </div>

        <div className="max-w-[72%] space-y-2 sm:max-w-[58%]">
          <div className="text-[11px] font-bold leading-tight text-white/80 sm:text-sm">*Рейтинг отражает максимальный уровень игроков.</div>
          <h2 className="font-display text-3xl font-black leading-none text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.9)] sm:text-5xl md:text-6xl">
            Лига eFootball™
          </h2>
          <p className="max-w-xl text-lg font-black leading-tight text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.9)] sm:text-3xl md:text-4xl">
            Стремитесь перейти в более высокий дивизион!
          </p>
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
