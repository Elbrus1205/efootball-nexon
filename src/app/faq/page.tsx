import Link from "next/link";
import { ArrowUpRight, LifeBuoy } from "lucide-react";
import styles from "@/components/faq/faq.module.css";
import { ProfileStatusTone } from "@prisma/client";
import { FaqSearch, type FaqSearchEntry } from "@/components/faq/faq-search";
import { db } from "@/lib/db";
import { buildFaqSearchText, resolveFaqBlocks } from "@/lib/faq/content";
import { profileStatusClassName } from "@/lib/profile-status-style";

export const revalidate = 300;

const PROFILE_STATUSES_FAQ_ID = "seed-75-profile-statuses";

const profileStatusFaqBadges = [
  { title: "Действующий чемпион", tone: ProfileStatusTone.GOLD },
  { title: "Чемпион сезона", tone: ProfileStatusTone.GOLD },
  { title: "Вице-чемпион сезона", tone: ProfileStatusTone.PURPLE },
  { title: "Бронзовый призёр", tone: ProfileStatusTone.BLUE },
  { title: "Легенда", tone: ProfileStatusTone.PURPLE },
  { title: "Активный", tone: ProfileStatusTone.BLUE },
  { title: "Надёжный", tone: ProfileStatusTone.BLUE },
] as const;

function ProfileStatusBadges() {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {profileStatusFaqBadges.map((status) => (
        <span
          key={status.title}
          className={profileStatusClassName(status.tone, "min-h-7 px-2.5 py-1 text-xs")}
        >
          {status.title}
        </span>
      ))}
    </div>
  );
}

export default async function FaqPage() {
  const items = await db.faqItem.findMany({
    where: { isPublished: true },
    include: { attachments: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const entries: FaqSearchEntry[] = [];

  for (const item of items) {
    const blocks = resolveFaqBlocks(item);
    const category = item.category || "Общее";
    entries.push({
      id: item.id,
      title: item.title,
      category,
      blocks,
      searchText: buildFaqSearchText({ title: item.title, category, blocks }),
      extra: item.id === PROFILE_STATUSES_FAQ_ID ? <ProfileStatusBadges /> : undefined,
    });
  }

  return (
    <div className={`page-shell ${styles.scope}`}>
      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}><LifeBuoy size={15} aria-hidden="true" />Центр помощи · FAQ</div>
          <h1 className={styles.title}>Помощь игрокам</h1>
          <p className={styles.intro}>От первого входа до финального свистка. Ответы о профиле, турнирах и матчах — в одном месте.</p>
        </div>
        <Link href="/tournaments" className={styles.heroLink}>К турнирам <ArrowUpRight size={15} aria-hidden="true" /></Link>
      </section>

      <FaqSearch entries={entries} />
    </div>
  );
}
