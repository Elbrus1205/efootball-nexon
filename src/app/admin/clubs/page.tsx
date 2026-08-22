import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ensureManagedClubCatalog } from "@/lib/clubs";
import { ClubEditor } from "@/components/admin/club-editor";

export default async function AdminClubsPage() {
  await requirePermission("content.manage");
  await ensureManagedClubCatalog();
  const [leagues, clubs] = await Promise.all([
    db.league.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, name: true, badgePath: true, isEnabled: true } }),
    db.club.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, slug: true, name: true, imagePath: true, isRegistrationEnabled: true, isInGameEnabled: true, leagueId: true } }),
  ]);
  return <div className="space-y-6"><div><div className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Каталог</div><h2 className="mt-2 text-2xl font-semibold text-white">Клубы и лиги</h2><p className="mt-2 max-w-2xl text-sm text-zinc-400">Управляйте видимостью эмблем в регистрации и доступностью клубов в игре.</p></div><ClubEditor leagues={leagues} clubs={clubs} /></div>;
}
