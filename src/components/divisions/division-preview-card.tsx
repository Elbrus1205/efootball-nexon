import Link from "next/link";
import Image from "next/image";
import { Lock, Swords } from "lucide-react";
import { cn } from "@/lib/utils";

export function DivisionPreviewCard({ canOpen, coverImage, priorityImage = false }: { canOpen: boolean; coverImage?: string | null; priorityImage?: boolean }) {
  const content = (
    <div
      className={cn(
        "group relative aspect-video overflow-hidden rounded-[26px] border border-white/10 bg-black shadow-[0_24px_70px_rgba(2,6,23,0.34)] transition duration-300",
        canOpen ? "hover:-translate-y-1 hover:border-amber-200/25 hover:shadow-[0_28px_80px_rgba(33,241,168,0.12)]" : "cursor-not-allowed",
      )}
      aria-disabled={!canOpen}
    >
      {coverImage ? (
        <Image
          src={coverImage}
          alt=""
          fill
          priority={priorityImage}
          fetchPriority={priorityImage ? "high" : undefined}
          quality={86}
          sizes="(min-width: 1280px) 1216px, (min-width: 768px) calc(100vw - 48px), calc(100vw - 32px)"
          className={cn("object-cover transition duration-300", !canOpen && "scale-105 blur-[3px] grayscale opacity-55")}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_62%_18%,rgba(255,255,255,0.95),transparent_15%),radial-gradient(circle_at_72%_46%,rgba(33,241,168,0.95),transparent_24%),radial-gradient(circle_at_34%_24%,rgba(33,241,168,0.7),transparent_22%),radial-gradient(circle_at_40%_78%,rgba(33,241,168,0.75),transparent_22%),linear-gradient(135deg,#1D1D1D_0%,#1D1D1D_42%,#1D1D1D_100%)]" />
      )}

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.56)),linear-gradient(90deg,rgba(0,0,0,0.34),rgba(0,0,0,0.08)_52%,rgba(0,0,0,0.4))]" />
      <div className={cn("absolute inset-0 transition", !canOpen && "backdrop-blur-[7px]")} />
      {!canOpen ? <div className="absolute inset-0 z-10 bg-black/52" /> : null}

      <div className="relative z-20 flex h-full flex-col justify-between p-4 sm:p-6 md:p-8">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/35 text-amber-100 backdrop-blur sm:h-12 sm:w-12">
            {canOpen ? <Swords className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </div>
        </div>

        <div className="max-w-[72%] space-y-1.5 sm:max-w-[58%] sm:space-y-2">
          <h2 className="font-display text-2xl font-black leading-none text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.9)] sm:text-4xl md:text-5xl">
            Лига eFootball
          </h2>
          <p className="max-w-xl text-sm font-black leading-tight text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.9)] sm:text-2xl md:text-3xl">
            Стремитесь перейти в более высокий дивизион!
          </p>
        </div>

        {!canOpen ? (
          <div className="absolute inset-x-4 top-1/2 z-30 -translate-y-1/2 rounded-2xl border border-white/10 bg-black/65 p-4 text-center shadow-2xl backdrop-blur-xl">
            <div className="text-sm font-bold text-white">Доступ только для администраторов</div>
            <div className="mt-1 text-xs leading-5 text-zinc-400">Игроки пока не могут открыть режим дивизионов.</div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return canOpen ? <Link href="/divisions">{content}</Link> : content;
}
