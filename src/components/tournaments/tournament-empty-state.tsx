import type { LucideIcon } from "lucide-react";
import { CircleDashed } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function TournamentEmptyState({
  title,
  description,
  icon: Icon = CircleDashed,
  action,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <Card className="flex min-h-44 flex-col items-center justify-center border-dashed p-6 text-center sm:p-8">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-400">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-zinc-400">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </Card>
  );
}
