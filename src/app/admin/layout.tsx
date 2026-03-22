import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR]);

  return (
    <div className="page-shell space-y-6">
      <div className="space-y-3">
        <div className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Tournament Ops</div>
        <h1 className="font-display text-3xl font-thin text-white sm:text-4xl">Панель управления турнирами</h1>
        <p className="max-w-3xl text-zinc-400">
          Единое пространство для структуры турниров, участников, матчей, расписания и модерации результатов.
        </p>
      </div>

      <AdminNav />
      {children}
    </div>
  );
}
