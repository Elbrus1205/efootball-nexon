import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await requireAuth();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      tournamentEntries: {
        include: { tournament: true },
        orderBy: { createdAt: "desc" },
      },
      playerOneMatches: {
        include: { tournament: true, player2: true },
        where: { status: { in: ["READY", "PENDING"] } },
      },
      playerTwoMatches: {
        include: { tournament: true, player1: true },
        where: { status: { in: ["READY", "PENDING"] } },
      },
    },
  });

  if (!user) return null;

  return (
    <div className="page-shell space-y-8">
      <div className="space-y-3">
        <Badge variant="primary">Личный кабинет игрока</Badge>
        <h1 className="font-display text-3xl font-thin text-white">Профиль игрока {user.nickname || user.name || "eFootball Mobile"}.</h1>
        <p className="max-w-2xl text-zinc-400">
          В кабинете игрока собраны личные данные и список турниров, в которых он участвует.
        </p>
      </div>

      <div className="grid gap-6">
        <ProfileForm
          initialValues={{
            nickname: user.nickname ?? "",
            efootballUid: user.efootballUid ?? "",
            favoriteTeam: user.favoriteTeam ?? "",
            image: user.image ?? "",
          }}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Турниры игрока</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {user.tournamentEntries.length ? (
            user.tournamentEntries.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="font-medium text-white">{entry.tournament.title}</div>
                <div className="mt-2 text-sm text-zinc-400">Дата старта: {formatDate(entry.tournament.startsAt)}</div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-4 text-sm text-zinc-500">
              Игрок пока не зарегистрирован ни в одном турнире.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
