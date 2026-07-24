import Link from "next/link";
import Image from "next/image";

function abbreviateClubName(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length <= 1 || name.length <= 12) return name;
  const [first, ...rest] = words;
  return `${first} ${rest.map((w) => (w[0] ?? "").toUpperCase() + ".").join(" ")}`;
}

type ClubPlayerLineProps = {
  clubName?: string | null;
  badgePath?: string | null;
  playerId?: string | null;
  playerName: string;
  align?: "left" | "center";
  compact?: boolean;
  reverse?: boolean;
  stack?: boolean;
};

export function ClubPlayerLine({
  clubName,
  badgePath,
  playerId,
  playerName,
  align = "left",
  compact = false,
  reverse = false,
  stack = false,
}: ClubPlayerLineProps) {
  const centered = align === "center";

  // Stacked layout: club badge sits on top, name + nickname below, all centered.
  // Text is ~1.2x smaller than the default horizontal layout.
  if (stack) {
    return (
      <div className="flex flex-col items-center gap-1 text-center sm:gap-1.5">
        {badgePath ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/20 sm:h-9 sm:w-9">
            <Image src={badgePath} alt={clubName ?? playerName} width={36} height={36} className="h-full w-full object-contain p-1" />
          </div>
        ) : null}
        <div className="min-w-0 max-w-full">
          <div className="max-w-full break-words text-xs font-medium leading-[1.2] text-white line-clamp-2">{clubName ?? "Клуб не назначен"}</div>
          {playerId ? (
            <Link
              href={`/players/${playerId}`}
              className="mt-0.5 block max-w-full truncate text-[10px] leading-tight text-zinc-400 underline-offset-4 transition hover:text-primary hover:underline"
            >
              {playerName}
            </Link>
          ) : (
            <div className="mt-0.5 max-w-full truncate text-[10px] leading-tight text-zinc-400">{playerName}</div>
          )}
        </div>
      </div>
    );
  }

  const directionClass = reverse ? "flex-row-reverse" : "flex-row";
  const wrapperClass = centered ? "items-center text-center" : reverse ? "items-end text-right" : "items-start text-left";

  const rawName = clubName ?? "Клуб не назначен";
  const displayName = compact ? abbreviateClubName(rawName) : rawName;
  const clubFontClass = compact && displayName.length > 15 ? "text-xs" : "text-sm";

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
        <div className={`max-w-full break-words font-medium leading-[1.25] text-white line-clamp-2 ${clubFontClass}`}>{displayName}</div>
        {playerId ? (
          <Link
            href={`/players/${playerId}`}
            className="mt-0.5 block max-w-full truncate text-xs leading-tight text-zinc-400 underline-offset-4 transition hover:text-primary hover:underline"
          >
            {playerName}
          </Link>
        ) : (
          <div className="mt-0.5 max-w-full truncate text-xs leading-tight text-zinc-400">{playerName}</div>
        )}
      </div>
    </div>
  );
}
