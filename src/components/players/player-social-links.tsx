import { TelegramProfileLink } from "@/components/telegram-profile-link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { SocialLink } from "@/lib/social-links";
import styles from "./player-profile.module.css";

type PlayerSocialLink = SocialLink | {
  id: "youtube";
  label: "YouTube";
  handle: string;
  href: string;
};

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M21.6 4.2c.2-1-.7-1.7-1.6-1.3L2.8 9.5c-1.1.4-1 2 .1 2.3l4.4 1.4 1.7 5.2c.4 1.1 1.8 1.4 2.5.5l2.5-3 4.4 3.3c.8.6 1.9.1 2.1-.9l3.1-14.1Zm-5.9 3.4-6.5 5.8-.3 3 1.1-2.2 6.9-6.1c.4-.4-.1-.8-.6-.5Z" />
    </svg>
  );
}

function VkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M13.1 18.1c-7.5 0-11.8-5.1-12-13.7h3.8c.1 6.3 2.9 9 5.1 9.5V4.4h3.6v5.4c2.2-.2 4.5-2.8 5.3-5.4h3.6c-.6 3.2-3.1 5.8-4.9 6.9 1.8.9 4.7 3.2 5.8 6.8h-4c-.8-2.5-2.9-4.4-5.8-4.7v4.7h-.5Z" />
    </svg>
  );
}

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />
    </svg>
  );
}

const socialStyles = {
  telegram: {
    label: "Telegram",
    icon: TelegramIcon,
  },
  vk: {
    label: "VK",
    icon: VkIcon,
  },
  youtube: {
    label: "YouTube",
    icon: YoutubeIcon,
  },
} satisfies Record<PlayerSocialLink["id"], { label: string; icon: typeof TelegramIcon }>;

export function PlayerSocialLinks({ links }: { links: PlayerSocialLink[] }) {
  if (!links.length) return null;

  return (
    <section aria-labelledby="profile-social-heading">
      <h2 id="profile-social-heading" className={styles.groupTitle}>Соцсети</h2>
      <Card className={styles.panel}>
      <div className={styles.socialList}>
        {links.map((link) => {
          const style = socialStyles[link.id];
          const Icon = style.icon;
          const className = styles.socialLink;
          const ariaLabel = `Открыть ${style.label}`;
          const content = (
            <>
              <span className={styles.socialIcon}>
                <Icon className="h-4 w-4" />
              </span>
              <span className={styles.socialCopy}>
                <span className={styles.socialLabel}>{style.label}</span>
                <span className={styles.socialHandle}>{link.handle}</span>
              </span>
              <ChevronRight className={styles.chevron} size={16} aria-hidden="true" />
            </>
          );

          if (link.id === "telegram" && link.telegramProfile) {
            return (
              <TelegramProfileLink key={link.id} {...link.telegramProfile} className={className} ariaLabel={ariaLabel}>
                {content}
              </TelegramProfileLink>
            );
          }

          return (
            <a key={link.id} href={link.href} target="_blank" rel="noreferrer" className={className} aria-label={ariaLabel}>
              {content}
            </a>
          );
        })}
      </div>
      </Card>
    </section>
  );
}
