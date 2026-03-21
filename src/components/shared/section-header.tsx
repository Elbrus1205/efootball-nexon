export function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-2xl space-y-3">
      {eyebrow ? <div className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">{eyebrow}</div> : null}
      <h2 className="section-title">{title}</h2>
      {description ? <p className="text-base text-zinc-400 sm:text-lg">{description}</p> : null}
    </div>
  );
}
