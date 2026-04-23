import Link from "next/link";
import { CalendarDays, FileText, Mail, ShieldCheck } from "lucide-react";
import { legalDocuments, type LegalDocument, type LegalSection, type LegalSubsection } from "@/lib/legal-documents";

function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
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
    <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4 sm:p-5">
      <h3 className="text-base font-semibold text-white sm:text-lg">{subsection.title}</h3>
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
    <section
      id={sectionId}
      className="scroll-mt-24 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:p-6"
    >
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

function LegalSectionNav({ document }: { document: LegalDocument }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Разделы</div>
      <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:grid lg:gap-2 lg:overflow-visible lg:pb-0">
        {document.sections.map((section, index) => (
          <a
            key={section.title}
            href={`#section-${index + 1}`}
            className="whitespace-nowrap rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-300 transition hover:border-primary/30 hover:text-white lg:rounded-xl lg:bg-transparent lg:px-0 lg:py-0 lg:text-sm lg:leading-5"
          >
            {section.title}
          </a>
        ))}
      </nav>
    </div>
  );
}

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  const showSupportCard = document.slug !== "offer";

  return (
    <div className="page-shell py-8 sm:py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(8,14,24,0.96),rgba(5,18,34,0.9))] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.28)] sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_28%),radial-gradient(circle_at_85%_18%,rgba(34,197,94,0.1),transparent_24%)]" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                <ShieldCheck className="h-4 w-4" />
                {document.badge}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                <CalendarDays className="h-4 w-4" />
                Редакция от {document.updatedAt}
              </span>
            </div>

            <div className="mt-5 max-w-4xl">
              <h1 className="font-display text-4xl font-thin tracking-tight text-white sm:text-5xl">{document.title}</h1>
              <p className="mt-4 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">{document.description}</p>
            </div>

            {document.highlight ? (
              <div className="mt-6 max-w-4xl rounded-[1.5rem] border border-emerald-300/20 bg-emerald-400/10 p-4 sm:p-5">
                <p className="text-sm leading-7 text-emerald-50/90 sm:text-base sm:leading-8">{document.highlight}</p>
              </div>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {legalDocuments.map((item) => (
                <Link
                  key={item.slug}
                  href={`/${item.slug}`}
                  className={`rounded-[1.3rem] border px-4 py-3 text-sm font-semibold transition ${
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
        </div>

        <div className="lg:hidden">
          <LegalSectionNav document={document} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <LegalSectionNav document={document} />
            </div>
          </aside>

          <div className="space-y-4 sm:space-y-5">
            {document.sections.map((section, index) => (
              <LegalSectionBlock key={section.title} section={section} sectionId={`section-${index + 1}`} />
            ))}

            {document.requisites ? (
              <section className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:p-6">
                <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{document.requisites.title}</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {document.requisites.fields.map((field) => (
                    <div key={field.label} className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{field.label}</div>
                      <div className="mt-2 text-sm leading-6 text-zinc-200 sm:text-base">{field.value}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {document.footerNote ? (
              <div className="rounded-[1.4rem] border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100 sm:text-base sm:leading-7">
                {document.footerNote}
              </div>
            ) : null}

            {showSupportCard ? (
              <div className="rounded-[1.4rem] border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100 sm:text-base sm:leading-7">
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
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
