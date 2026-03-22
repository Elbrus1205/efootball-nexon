import Link from "next/link";
import { Shield, Trophy, Users } from "lucide-react";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";

export default async function AdminPage() {
  const session = await requireRole([UserRole.ADMIN, UserRole.MODERATOR]);
  const cards = [
    { href: "/admin/users", title: "Пользователи", icon: Users, roles: ["ADMIN"] },
    { href: "/admin/tournaments", title: "Турниры", icon: Trophy, roles: ["ADMIN"] },
    { href: "/admin/moderation", title: "Модерация матчей", icon: Shield, roles: ["ADMIN", "MODERATOR"] },
  ];

  return (
    <div className="page-shell space-y-8">
      <div className="space-y-3">
        <h1 className="font-display text-3xl font-thin text-white">Админ-панель</h1>
        <p className="text-zinc-400">Роль: {session.user.role}. Здесь доступны разделы управления платформой и модерации.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {cards
          .filter((card) => card.roles.includes(session.user.role))
          .map((card) => (
            <Link key={card.href} href={card.href}>
              <Card className="p-6 transition hover:-translate-y-1">
                <card.icon className="mb-4 h-6 w-6 text-primary" />
                <div className="font-display text-xl font-thin text-white">{card.title}</div>
              </Card>
            </Link>
          ))}
      </div>
    </div>
  );
}
