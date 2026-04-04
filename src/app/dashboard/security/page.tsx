import { headers } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { SecurityPanel } from "@/components/dashboard/security-panel";
import { buildSecurityContext } from "@/lib/auth/security";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

function sessionIcon(platform: string | null): "laptop" | "phone" {
  const normalized = (platform ?? "").toLowerCase();
  return normalized.includes("iphone") || normalized.includes("android") ? "phone" : "laptop";
}

export default async function DashboardSecurityPage() {
  const session = await requireAuth();
  const currentContext = buildSecurityContext(headers());

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      emailVerified: true,
      passwordHash: true,
      telegramId: true,
      telegramUsername: true,
      telegram2faEnabled: true,
      vkId: true,
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
          ipAddress: true,
          lastActiveAt: true,
        },
      },
    },
  });

  if (!user) return null;

  const sessions = user.securitySessions.map((item) => {
    const isCurrent = session.user.authSessionId === item.authSessionId;

    return {
      id: item.authSessionId,
      device:
        isCurrent &&
        (!item.device || item.device === "Текущее устройство" || item.device === "Неизвестное устройство")
          ? currentContext.device
          : item.device,
      platform:
        isCurrent && (!item.platform || item.platform === "Не определено")
          ? currentContext.platform
          : item.platform ?? "Не определено",
      location:
        isCurrent && (!item.location || item.location === "Не определено")
          ? currentContext.location
          : item.location ?? "Не определено",
      ipAddress:
        isCurrent && !item.ipAddress ? currentContext.ipAddress ?? "IP скрыт" : item.ipAddress ?? "IP скрыт",
      lastActive: formatDate(item.lastActiveAt),
      current: isCurrent,
      icon: sessionIcon(isCurrent ? currentContext.platform : item.platform),
    };
  });

  return (
    <div className="page-shell py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-3">
          <Badge variant="primary">Безопасность</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-white">Безопасность аккаунта</h1>
            <p className="max-w-2xl text-sm text-zinc-400">
              Управление паролем, email, защитой входа и устройствами аккаунта.
            </p>
          </div>
        </div>

        <SecurityPanel
          currentEmail={user.email ?? ""}
          emailVerified={Boolean(user.emailVerified)}
          hasPassword={Boolean(user.passwordHash)}
          telegramLinked={Boolean(user.telegramId)}
          telegramHandle={user.telegramUsername ?? null}
          telegram2faEnabled={Boolean(user.telegram2faEnabled)}
          vkLinked={Boolean(user.vkId)}
          sessions={sessions}
        />
      </div>
    </div>
  );
}
