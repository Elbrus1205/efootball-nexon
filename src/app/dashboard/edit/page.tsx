import { Badge } from "@/components/ui/badge";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { requireAuth } from "@/lib/auth/session";
import { getAvailableClubs } from "@/lib/clubs";
import { db } from "@/lib/db";
import { getActiveProfileStatusWhere } from "@/lib/profile-status-query";
import { notifyExpiredProfileStatuses } from "@/lib/profile-statuses";

export default async function DashboardEditPage() {
  const session = await requireAuth();
  await notifyExpiredProfileStatuses({ userId: session.user.id });
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      profileStatuses: {
        where: getActiveProfileStatusWhere(),
        orderBy: [{ selectedOrder: "asc" }, { createdAt: "desc" }],
      },
    },
  });
  const clubs = await getAvailableClubs();

  if (!user) return null;

  const registeredAt = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(user.createdAt);

  return (
    <div className="page-shell space-y-8">
      <div className="space-y-3">
        <Badge variant="primary">Редактор профиля</Badge>
      </div>

      <ProfileForm
        initialValues={{
          name: user.name ?? "",
          favoriteTeam: user.favoriteTeam ?? "",
          bio: user.bio ?? "",
          image: user.image ?? "",
          bannerImage: user.bannerImage ?? "",
          registeredAt,
          selectedStatusIds: user.profileStatuses.filter((status) => status.selectedOrder !== null).map((status) => status.id),
        }}
        statuses={user.profileStatuses.map((status) => ({
          id: status.id,
          title: status.title,
          description: status.description,
          tone: status.tone,
          type: status.type,
          selectedOrder: status.selectedOrder,
        }))}
        clubs={clubs}
      />
    </div>
  );
}

