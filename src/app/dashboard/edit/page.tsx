import { Badge } from "@/components/ui/badge";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { requireAuth } from "@/lib/auth/session";
import { getAvailableClubs } from "@/lib/clubs";
import { db } from "@/lib/db";
import { ProfileStatusApprovalStatus } from "@prisma/client";

export default async function DashboardEditPage() {
  const session = await requireAuth();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      profileStatuses: {
        where: { approvalStatus: ProfileStatusApprovalStatus.APPROVED },
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
          selectedOrder: status.selectedOrder,
        }))}
        clubs={clubs}
      />
    </div>
  );
}

