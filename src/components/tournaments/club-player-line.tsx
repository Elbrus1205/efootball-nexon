import Link from "next/link";

type ClubPlayerLineProps = {
  clubName?: string | null;
  badgePath?: string | null;
  playerId?: string | null;
  playerName: string;
  align?: "left" | "center";
  compact?: boolean;
};

export function ClubPlayerLine({
  clubName,
  badgePath,
  playerId,
  playerName,
  align = "left",
  compact = false,
}: ClubPlayerLineProps) {
  const alignmentClass = align === "center" ? "items-center text-center" : "items-start text-left";

  return (
    <div className={`flex gap-3 ${alignmentClass}`}>
      {badgePath ? (
        <div
          className={
            compact
              ? "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/20"
              : "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/20"
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={badgePath} alt={clubName ?? playerName} className="h-full w-full object-contain p-1" />
        </div>
      ) : null}
      <div className={`min-w-0 ${alignmentClass}`}>
        <div className={compact ? "text-sm font-medium text-white" : "text-sm font-medium text-white"}>{clubName ?? "Клуб не назначен"}</div>
        {playerId ? (
          <Link href={`/players/${playerId}`} className="mt-1 text-xs text-zinc-400 underline-offset-4 transition hover:text-primary hover:underline">
            {playerName}
          </Link>
        ) : (
          <div className="mt-1 text-xs text-zinc-400">{playerName}</div>
        )}
      </div>
    </div>
  );
}
