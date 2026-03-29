import Link from "next/link";
import { PencilLine } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await requireAuth();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) return null;

  const displayName = user.nickname || "Игрок eFootball Nexon";

  return (
    <div className="page-shell space-y-8">
      <div className="space-y-3">
        <Badge variant="primary">Личный кабинет игрока</Badge>
      </div>

      <Card className="overflow-hidden border-white/10 bg-white/[0.03]">
        <div className="relative overflow-hidden border-b border-white/10">
          <div
            className="h-40 bg-[linear-gradient(180deg,rgba(22,33,54,1),rgba(12,18,30,1))] sm:h-52"
            style={
              user.bannerImage
                ? {
                    backgroundImage: `linear-gradient(180deg, rgba(8,10,16,0.18), rgba(8,10,16,0.7)), url(${user.bannerImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:36px_36px] opacity-20" />

          <div className="relative px-5 pb-6 sm:px-6">
            <div className="-mt-10 flex items-end justify-between gap-4 sm:-mt-12">
              <div className="flex min-w-0 items-end gap-4">
                <div className="relative shrink-0">
                  <Avatar className="h-20 w-20 rounded-[1.75rem] border-4 border-[#101827] shadow-[0_18px_60px_rgba(0,0,0,0.45)] sm:h-24 sm:w-24">
                    <AvatarImage src={user.image || undefined} alt="Аватар игрока" />
                    <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>

                  <Button
                    asChild
                    size="icon"
                    variant="secondary"
                    className="absolute -right-1 -top-1 h-9 w-9 rounded-full border border-white/10 bg-[#111827] shadow-[0_10px_25px_rgba(0,0,0,0.28)] sm:hidden"
                  >
                    <Link href="/dashboard/edit" aria-label="Редактировать профиль">
                      <PencilLine className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>

                <div className="min-w-0 pb-1">
                  <h1 className="truncate text-[1.9rem] font-semibold leading-none text-white sm:text-3xl">
                    {displayName}
                  </h1>
                  {user.bio ? (
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{user.bio}</p>
                  ) : null}
                </div>
              </div>

              <Button asChild variant="secondary" className="hidden gap-2 sm:inline-flex">
                <Link href="/dashboard/edit">
                  <PencilLine className="h-4 w-4" />
                  Редактировать профиль
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Никнейм</div>
            <div className="mt-2 text-sm font-medium text-white">{displayName}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Любимый клуб</div>
            <div className="mt-2 text-sm font-medium text-white">{user.favoriteTeam || "Не выбран"}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
