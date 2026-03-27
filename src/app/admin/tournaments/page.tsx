import Link from "next/link";
import { UserRole } from "@prisma/client";
import { Eye, Layers3, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  playoffTypeLabel,
  tournamentFormatLabel,
  tournamentStatusLabel,
  tournamentStatusVariant,
} from "@/lib/admin-display";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export default async function AdminTournamentsPage({
  searchParams,
}: {
  searchParams?: { created?: string; warning?: string };
}) {
  await requireRole([UserRole.ADMIN]);

  const tournaments = await db.tournament.findMany({
    include: {
      _count: { select: { participants: true, stages: true, matches: true } },
      season: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      {searchParams?.created ? (
        <Card className="border-emerald-400/20 bg-emerald-500/10">
          <CardDescription className="p-5 text-sm text-emerald-100">
            РўСѓСЂРЅРёСЂ СѓСЃРїРµС€РЅРѕ СЃРѕР·РґР°РЅ.
            {searchParams.warning ? ` ${searchParams.warning}` : ""}
          </CardDescription>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>РўСѓСЂРЅРёСЂС‹ Рё С„РѕСЂРјР°С‚С‹</CardTitle>
            <CardDescription>Р•РґРёРЅС‹Р№ СЃРїРёСЃРѕРє С‚СѓСЂРЅРёСЂРѕРІ, СЃС‚Р°РґРёР№ Рё РѕРїРµСЂР°С†РёРѕРЅРЅС‹С… РґРµР№СЃС‚РІРёР№: СЂРµРіРёСЃС‚СЂР°С†РёСЏ, РіСЂСѓРїРїС‹, РїР»РµР№-РѕС„С„ Рё СЂР°СЃРїРёСЃР°РЅРёРµ.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link href="/admin/tournaments/builder">
                <Layers3 className="mr-2 h-4 w-4" />
                РљРѕРЅСЃС‚СЂСѓРєС‚РѕСЂ С‚СѓСЂРЅРёСЂР°
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/tournaments/builder">
                <Plus className="mr-2 h-4 w-4" />
                РЎРѕР·РґР°С‚СЊ С‚СѓСЂРЅРёСЂ
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4">
        {tournaments.map((tournament) => (
          <Card key={tournament.id} className="p-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium text-white">{tournament.title}</div>
                  <Badge variant={tournamentStatusVariant[tournament.status]}>{tournamentStatusLabel[tournament.status]}</Badge>
                  <Badge variant="neutral">{tournamentFormatLabel[tournament.format]}</Badge>
                  {tournament.playoffType ? <Badge variant="accent">{playoffTypeLabel[tournament.playoffType]}</Badge> : null}
                </div>
                <p className="max-w-3xl text-sm leading-6 text-zinc-400">{tournament.description}</p>
                <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
                  <span>РЎС‚Р°СЂС‚: {formatDate(tournament.startsAt)}</span>
                  <span>Р РµРіРёСЃС‚СЂР°С†РёСЏ РґРѕ: {formatDate(tournament.registrationEndsAt)}</span>
                  <span>РЈС‡Р°СЃС‚РЅРёРєРё: {tournament._count.participants}/{tournament.maxParticipants}</span>
                  <span>РЎС‚Р°РґРёРё: {tournament._count.stages}</span>
                  <span>РњР°С‚С‡Рё: {tournament._count.matches}</span>
                  <span>РЎРµР·РѕРЅ: {tournament.season?.name ?? "Р‘РµР· СЃРµР·РѕРЅР°"}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="secondary">
                  <Link href={`/admin/tournaments/${tournament.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    Workspace
                  </Link>
                </Button>

                <form action={`/api/admin/tournaments/${tournament.id}`} method="post">
                  <input type="hidden" name="_method" value="assign-random-clubs" />
                  <Button variant="outline">Р Р°СЃРїСЂРµРґРµР»РёС‚СЊ РєР»СѓР±С‹</Button>
                </form>

                <Button asChild variant="outline">
                  <Link href={`/tournaments/${tournament.id}`}>РџСѓР±Р»РёС‡РЅР°СЏ СЃС‚СЂР°РЅРёС†Р°</Link>
                </Button>

                <form action={`/api/admin/tournaments/${tournament.id}`} method="post">
                  <input type="hidden" name="_method" value="generate-stages" />
                  <Button variant="outline">Сгенерировать стадии</Button>
                </form>

                <form action={`/api/admin/tournaments/${tournament.id}`} method="post">
                  <input type="hidden" name="_method" value="generate-matches" />
                  <Button variant="outline">Создать матчи и расписание</Button>
                </form>

                <Button asChild variant="outline">
                  <Link href={`/admin/tournaments/${tournament.id}/edit`}>Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/admin/tournaments/${tournament.id}/participants`}>РЈС‡Р°СЃС‚РЅРёРєРё</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/admin/tournaments/${tournament.id}/stages`}>РЎС‚Р°РґРёРё</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/admin/tournaments/${tournament.id}/standings`}>РўР°Р±Р»РёС†С‹</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/admin/tournaments/${tournament.id}/bracket`}>РЎРµС‚РєР°</Link>
                </Button>

                <form action={`/api/admin/tournaments/${tournament.id}`} method="post">
                  <input type="hidden" name="_method" value="delete" />
                  <Button variant="outline" className="border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100">
                    РЈРґР°Р»РёС‚СЊ С‚СѓСЂРЅРёСЂ
                  </Button>
                </form>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {!tournaments.length ? (
        <Card className="p-6 text-sm text-zinc-500">РџРµСЂРІС‹Р№ С‚СѓСЂРЅРёСЂ РјРѕР¶РЅРѕ СЃРѕР±СЂР°С‚СЊ С‡РµСЂРµР· РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂ: С„РѕСЂРјР°С‚, СЃС‚Р°РґРёРё, СѓС‡Р°СЃС‚РЅРёРєРё Рё СЂР°СЃРїРёСЃР°РЅРёРµ.</Card>
      ) : null}
    </div>
  );
}
