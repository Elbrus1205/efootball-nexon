import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SecurityPanel } from "@/components/dashboard/security-panel";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

function sessionIcon(platform: string | null): "laptop" | "phone" {
  const normalized = (platform ?? "").toLowerCase();
  return normalized.includes("iphone") || normalized.includes("android") ? "phone" : "laptop";
}

export default async function DashboardSecurityPage() {
  const session = await requireAuth();

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      emailVerified: true,
      passwordHash: true,
      telegramId: true,
      telegramUsername: true,
      telegram2faEnabled: true,
      securitySessions: {
        where: {
          revokedAt: null,
        },
        orderBy: {
          lastActiveAt: "desc",
        },
        take: 10,
        select: {
          authSessionId: true,
          device: true,
          platform: true,
          location: true,
          lastActiveAt: true,
        },
      },
      loginHistory: {
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
        select: {
          id: true,
          status: true,
          device: true,
          location: true,
          ipAddress: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) return null;

  const sessions = user.securitySessions.map((item) => ({
    id: item.authSessionId,
    device: item.device,
    platform: item.platform ?? "Не определено",
    location: item.location ?? "Не определено",
    lastActive: formatDate(item.lastActiveAt),
    current: session.user.authSessionId === item.authSessionId,
    icon: sessionIcon(item.platform),
  }));

  const loginHistory = user.loginHistory.map((item) => ({
    id: item.id,
    status: item.status === "SUCCESS" ? ("success" as const) : ("failed" as const),
    device: item.device,
    location: item.location ?? "Не определено",
    ip: item.ipAddress ?? "IP скрыт",
    createdAt: formatDate(item.createdAt),
  }));

  return (
    <div className="page-shell py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-3">
          <Badge variant="primary">Безопасность</Badge>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-white">Безопасность аккаунта</h1>
              <p className="max-w-2xl text-sm text-zinc-400">
                Управление паролем, email, защитой входа и устройствами аккаунта.
              </p>
            </div>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/dashboard">Назад к профилю</Link>
            </Button>
          </div>
        </div>

        <SecurityPanel
          currentEmail={user.email ?? ""}
          emailVerified={Boolean(user.emailVerified)}
          hasPassword={Boolean(user.passwordHash)}
          telegramLinked={Boolean(user.telegramId)}
          telegramHandle={user.telegramUsername ?? null}
          telegram2faEnabled={Boolean(user.telegram2faEnabled)}
          sessions={sessions}
          loginHistory={loginHistory}
        />
      </div>
    </div>
  );
}
