import type { SocialLink } from "@/lib/social-links";

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

const socialStyles = {
  telegram: {
    label: "Telegram",
    className: "border-sky-300/20 bg-sky-400/10 text-sky-100 hover:border-sky-300/45 hover:bg-sky-400/15",
    iconClassName: "bg-sky-400 text-white shadow-[0_8px_20px_rgba(56,189,248,0.25)]",
    icon: TelegramIcon,
  },
  vk: {
    label: "VK",
    className: "border-blue-300/20 bg-blue-500/10 text-blue-100 hover:border-blue-300/45 hover:bg-blue-500/15",
    iconClassName: "bg-[#2787f5] text-white shadow-[0_8px_20px_rgba(39,135,245,0.25)]",
    icon: VkIcon,
  },
} satisfies Record<SocialLink["id"], { label: string; className: string; iconClassName: string; icon: typeof TelegramIcon }>;

export function PlayerSocialLinks({ links }: { links: SocialLink[] }) {
  if (!links.length) return null;

  return (
    <div>
      <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Соцсети</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {links.map((link) => {
          const style = socialStyles[link.id];
          const Icon = style.icon;

          return (
            <a
              key={link.id}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className={`group flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${style.className}`}
              aria-label={`Открыть ${style.label}`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.iconClassName}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-xs font-bold uppercase text-current/60">{style.label}</span>
                <span className="block truncate text-white">{link.handle}</span>
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
