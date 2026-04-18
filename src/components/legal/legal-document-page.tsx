import Link from "next/link";
import { CalendarDays, FileText, Mail, ShieldCheck } from "lucide-react";
import { legalDocuments, type LegalDocument, type LegalSection, type LegalSubsection } from "@/lib/legal-documents";

function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-6 text-zinc-300 sm:text-base sm:leading-7">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function LegalSubsectionBlock({ subsection }: { subsection: LegalSubsection }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <h3 className="text-base font-semibold text-white">{subsection.title}</h3>
      {subsection.paragraphs ? (
        <div className="mt-3 space-y-3">
          {subsection.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-6 text-zinc-300 sm:text-base sm:leading-7">
              {paragraph}
            </p>
          ))}
        </div>
      ) : null}
      {subsection.list ? (
        <div className="mt-3">
          <LegalList items={subsection.list} />
        </div>
      ) : null}
    </div>
  );
}

function LegalSectionBlock({ section, sectionId }: { section: LegalSection; sectionId: string }) {
  return (
    <section id={sectionId} className="scroll-mt-24 border-b border-white/10 py-7 last:border-b-0 sm:py-8">
      <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{section.title}</h2>
      {section.paragraphs ? (
        <div className="mt-4 space-y-3">
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-6 text-zinc-300 sm:text-base sm:leading-7">
              {paragraph}
            </p>
          ))}
        </div>
      ) : null}
      {section.list ? (
        <div className="mt-4">
          <LegalList items={section.list} />
        </div>
      ) : null}
      {section.subsections ? (
        <div className="mt-5 grid gap-3">
          {section.subsections.map((subsection) => (
            <LegalSubsectionBlock key={subsection.title} subsection={subsection} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return (
    <div className="page-shell py-8 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-lg border border-white/10 bg-white/[0.035] p-5 shadow-glow sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-primary">
              <ShieldCheck className="h-4 w-4" />
              {document.badge}
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-zinc-400">
              <CalendarDays className="h-4 w-4" />
              Редакция от {document.updatedAt}
            </span>
          </div>

          <div className="mt-5 max-w-3xl">
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{document.title}</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400 sm:text-base sm:leading-7">{document.description}</p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {legalDocuments.map((item) => (
              <Link
                key={item.slug}
                href={`/${item.slug}`}
                className={`rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                  item.slug === document.slug
                    ? "border-primary/35 bg-primary/10 text-white"
                    : "border-white/10 bg-black/20 text-zinc-400 hover:border-primary/30 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  {item.shortTitle}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Разделы</div>
              <nav className="mt-4 grid gap-2">
                {document.sections.map((section, index) => (
                  <a key={section.title} href={`#section-${index + 1}`} className="text-sm leading-5 text-zinc-400 transition hover:text-white">
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <article className="rounded-lg border border-white/10 bg-white/[0.03] px-5 sm:px-7">
            {document.sections.map((section, index) => (
              <LegalSectionBlock key={section.title} section={section} sectionId={`section-${index + 1}`} />
            ))}
          </article>
        </div>

        <div className="rounded-lg border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
          <div className="flex gap-3">
            <Mail className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              По вопросам персональных данных и документов сайта пишите на{" "}
              <a className="font-semibold underline decoration-amber-100/40 underline-offset-4" href="mailto:SadullaevEM@yandex.ru">
                SadullaevEM@yandex.ru
              </a>
              . Срок ответа на обращение — до 10 рабочих дней.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
