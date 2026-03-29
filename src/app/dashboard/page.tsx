import { Badge } from "@/components/ui/badge";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function DashboardPage() {
  const session = await requireAuth();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) return null;

  const isVerified = Boolean(user.emailVerified || user.telegramId || user.vkId);

  return (
    <div className="page-shell space-y-8">
      <div className="space-y-3">
        <Badge variant="primary">Личный кабинет игрока</Badge>
      </div>

      <div className="grid gap-6">
        <ProfileForm
          isVerified={isVerified}
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
