import { Download, ExternalLink, FileText, ImageIcon, LifeBuoy, PlayCircle } from "lucide-react";
import { FaqAttachmentKind } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";

function attachmentIcon(kind: FaqAttachmentKind) {
  if (kind === FaqAttachmentKind.IMAGE) return ImageIcon;
  if (kind === FaqAttachmentKind.VIDEO) return PlayCircle;
  if (kind === FaqAttachmentKind.FILE) return Download;
  return ExternalLink;
}

function answerParagraphs(answer: string) {
  return answer
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export default async function FaqPage() {
  const items = await db.faqItem.findMany({
    where: { isPublished: true },
    include: { attachments: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const groupedItems = items.reduce<Record<string, typeof items>>((groups, item) => {
    const category = item.category || "Общее";
    groups[category] = groups[category] ?? [];
    groups[category].push(item);
    return groups;
  }, {});

  return (
    <div className="page-shell space-y-8">
      <section className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          <LifeBuoy className="h-3.5 w-3.5" />
          FAQ
        </div>
        <h1 className="font-display text-3xl font-thin text-white sm:text-4xl">Помощь игрокам</h1>
        <p className="max-w-2xl text-sm leading-6 text-zinc-400">
          Короткие ответы по регистрации, турнирам, матчам, профилю, связи и заказам Coins.
        </p>
      </section>

      <div className="grid gap-6">
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <section key={category} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <h2 className="text-xl font-semibold text-white">{category}</h2>
            </div>

            <div className="grid gap-3">
              {categoryItems.map((item, index) => (
                <details key={item.id} className="group rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-glow open:bg-white/[0.06]" open={index === 0}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-white">
                    <span>{item.title}</span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-lg leading-none text-primary transition group-open:rotate-45">
                      +
                    </span>
                  </summary>

                  <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
                    {answerParagraphs(item.answer).map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>

                  {item.attachments.length ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {item.attachments.map((attachment) => {
                        const Icon = attachmentIcon(attachment.kind);

                        if (attachment.kind === FaqAttachmentKind.IMAGE) {
                          return (
                            <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="group/image overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={attachment.url} alt={attachment.title} className="aspect-video w-full object-cover transition group-hover/image:scale-[1.02]" />
                              <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white">
                                <Icon className="h-4 w-4 text-primary" />
                                {attachment.title}
                              </div>
                            </a>
                          );
                        }

                        return (
                          <a
                            key={attachment.id}
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex min-h-16 items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-medium text-white transition hover:border-primary/30 hover:bg-primary/10"
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1 truncate">{attachment.title}</span>
                            <ExternalLink className="h-4 w-4 shrink-0 text-zinc-500" />
                          </a>
                        );
                      })}
                    </div>
                  ) : null}
                </details>
              ))}
            </div>
          </section>
        ))}

        {!items.length ? <Card className="p-6 text-sm text-zinc-500">FAQ пока пустой. Ответы появятся после публикации в админ-панели.</Card> : null}
      </div>
    </div>
  );
}
