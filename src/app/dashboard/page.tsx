import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProfileForm } from "@/components/dashboard/profile-form";

export default async function DashboardPage() {
  const session = await requireAuth();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {},
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
    </div>
  );
}
