import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function TournamentLoading() {
  return (
    <div className="page-shell space-y-6" aria-busy="true" aria-label="Загрузка турнира">
      <Card className="hidden min-h-[420px] overflow-hidden rounded-3xl p-0 md:grid lg:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6 p-5 sm:p-7 lg:p-10">
          <div className="flex gap-2"><Skeleton className="h-7 w-28" /><Skeleton className="h-7 w-16" /></div>
          <Skeleton className="h-14 w-4/5" />
          <Skeleton className="h-5 w-full max-w-xl" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
          <Skeleton className="h-12 w-56" />
        </div>
        <Skeleton className="min-h-60 rounded-none lg:min-h-full" />
      </Card>
      <Skeleton className="h-16 w-full rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>
    </div>
  );
}
