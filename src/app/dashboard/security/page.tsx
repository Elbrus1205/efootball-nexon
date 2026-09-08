import { headers } from "next/headers";
import { SecurityPanel } from "@/components/dashboard/security-panel";
import { resolveSecurityContext } from "@/lib/auth/security";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import styles from "./security.module.css";

function sessionIcon(platform: string | null): "laptop" | "phone" {
  const normalized = (platform ?? "").toLowerCase();
  return normalized.includes("iphone") || normalized.includes("android") ? "phone" : "laptop";
}

export default async function DashboardSecurityPage() {
  const session = await requireAuth();
  const currentContext = await resolveSecurityContext(await headers());
  const telegramClientId = process.env.TELEGRAM_CLIENT_ID;
  const telegramEnabled = Boolean(telegramClientId);
  const vkAppId = process.env.NEXT_PUBLIC_VK_APP_ID ?? process.env.VK_CLIENT_ID;

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
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.intro}>
          <div>
            <div className={styles.eyebrow}>Account protection</div>
            <h1 className={styles.title}>Безопасность<br />аккаунта</h1>
            <p className={styles.description}>Настройте вход, привязки и активные устройства в одном спокойном пространстве.</p>
          </div>
          <div className={styles.status}><span className={styles.statusDot} /> Защита доступна</div>
        </div>

        <div className={styles.panel}>
        <SecurityPanel
          currentEmail={user.email ?? ""}
          emailVerified={Boolean(user.emailVerified)}
          hasPassword={Boolean(user.passwordHash)}
          telegramLinked={Boolean(user.telegramId)}
          telegramHandle={user.telegramUsername ?? null}
          telegram2faEnabled={Boolean(user.telegram2faEnabled)}
          telegramEnabled={telegramEnabled}
          telegramClientId={telegramClientId}
          vkAppId={vkAppId}
          vkLinked={Boolean(user.vkId)}
          sessions={sessions}
        />
        </div>
      </div>
    </div>
  );
}
