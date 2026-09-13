import Link from "next/link";
import Image from "next/image";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type ClubPlayerLineProps = {
  clubName?: string | null;
  badgePath?: string | null;
  playerId?: string | null;
  playerName: string;
  align?: "left" | "center";
  compact?: boolean;
  reverse?: boolean;
  stack?: boolean;
  showPlayerName?: boolean;
  isActive?: boolean;
  inactiveFromRound?: number | null;
};

function inactiveLabel(inactiveFromRound?: number | null) {
  return inactiveFromRound ? `Неактивен · с ${inactiveFromRound}-го тура` : "Неактивен";
}

export function ClubPlayerLine({
  clubName,
  badgePath,
  playerId,
  playerName,
  align = "left",
  compact = false,
  reverse = false,
  stack = false,
  showPlayerName = true,
  isActive = true,
  inactiveFromRound = null,
}: ClubPlayerLineProps) {
  const centered = align === "center";
  const rawName = clubName ?? "Клуб не назначен";
  const activityLabel = inactiveLabel(inactiveFromRound);

  // Stacked layout: club badge sits on top, name + nickname below, all centered.
  // Text is ~1.2x smaller than the default horizontal layout.
  if (stack) {
    return (
      <div className="flex flex-col items-center gap-1 text-center sm:gap-1.5">
        {badgePath ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/20 sm:h-9 sm:w-9">
            <Image src={badgePath} alt={rawName} width={36} height={36} className="h-full w-full object-contain p-1" />
          </div>
        ) : null}
        <div className="min-w-0 max-w-full">
          <div className={cn("max-w-full break-words text-xs font-medium leading-[1.2] line-clamp-2", isActive ? "text-white" : "text-rose-200")}>{clubName ?? "Клуб не назначен"}</div>
          {showPlayerName ? (
            playerId ? (
              <Link
                href={`/players/${playerId}`}
                className={cn("mt-0.5 block max-w-full truncate text-[10px] leading-tight underline-offset-4 transition hover:underline", isActive ? "text-zinc-400 hover:text-primary" : "text-rose-300/80 hover:text-rose-100")}
              >
                {playerName}
              </Link>
            ) : (
              <div className={cn("mt-0.5 max-w-full truncate text-[10px] leading-tight", isActive ? "text-zinc-400" : "text-rose-300/80")}>{playerName}</div>
            )
          ) : null}
          {!isActive ? (
            <span title={activityLabel} className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full border border-rose-300/25 bg-rose-400/10 px-1.5 py-0.5 text-[9px] font-semibold leading-tight text-rose-200">
              <CircleAlert className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{activityLabel}</span>
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  const directionClass = reverse ? "flex-row-reverse" : "flex-row";
  const wrapperClass = centered ? "items-center text-center" : reverse ? "items-end text-right" : "items-start text-left";

  const clubFontClass = compact
    ? rawName.length > 18 ? "text-[0.7rem]" : rawName.length > 13 ? "text-xs" : "text-sm"
    : "text-sm";

  return (
    <div className={`flex ${directionClass} ${compact ? "gap-2 sm:gap-3" : "gap-3"} ${centered ? "items-center justify-center" : "items-start"}`}>
      {badgePath ? (
        <div
          className={
            compact
              ? "flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/20 sm:h-8 sm:w-8"
              : "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/20"
          }
        >
          <Image src={badgePath} alt={rawName} width={compact ? 32 : 40} height={compact ? 32 : 40} className="h-full w-full object-contain p-1" />
        </div>
      ) : null}

      <div className={`min-w-0 flex-1 ${wrapperClass}`}>
        <div className={cn("max-w-full font-medium leading-[1.25] line-clamp-2", clubFontClass, isActive ? "text-white" : "text-rose-200")}>{rawName}</div>
        {showPlayerName ? (
          playerId ? (
            <Link
              href={`/players/${playerId}`}
              className={cn("mt-0.5 block max-w-full truncate text-xs leading-tight underline-offset-4 transition hover:underline", isActive ? "text-zinc-400 hover:text-primary" : "text-rose-300/80 hover:text-rose-100")}
            >
              {playerName}
            </Link>
          ) : (
            <div className={cn("mt-0.5 max-w-full truncate text-xs leading-tight", isActive ? "text-zinc-400" : "text-rose-300/80")}>{playerName}</div>
          )
        ) : null}
        {!isActive ? (
          <span title={activityLabel} className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full border border-rose-300/25 bg-rose-400/10 px-1.5 py-0.5 text-[9px] font-semibold leading-tight text-rose-200">
            <CircleAlert className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{activityLabel}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
