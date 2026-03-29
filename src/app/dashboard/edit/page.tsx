import { Badge } from "@/components/ui/badge";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function DashboardEditPage() {
  const session = await requireAuth();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) return null;

  return (
    <div className="page-shell space-y-8">
      <div className="space-y-3">
        <Badge variant="primary">Редактор профиля</Badge>
      </div>

      <ProfileForm
        initialValues={{
          nickname: user.nickname ?? "",
          favoriteTeam: user.favoriteTeam ?? "",
          bio: user.bio ?? "",
          image: user.image ?? "",
          bannerImage: user.bannerImage ?? "",
        }}
      />
    </div>
  );
}
