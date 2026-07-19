import type { InputHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const tournamentBuilderSelectClass =
  "h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition duration-200 hover:border-white/20 focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50";

export const tournamentBuilderInputClass =
  "h-12 border-white/10 bg-black/30 transition duration-200 hover:border-white/20 focus-visible:border-primary/60 focus-visible:ring-primary/30";

export function TournamentBuilderSection({
  id,
  number,
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  id: string;
  number: string;
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        "scroll-mt-24 overflow-hidden rounded-2xl border border-white/10 bg-[#1b1b1b] shadow-[0_18px_60px_rgba(0,0,0,0.2)]",
        className,
      )}
    >
      <div className="relative border-b border-white/10 bg-gradient-to-r from-primary/[0.08] via-transparent to-transparent px-4 py-5 sm:px-6">
        <div className="flex items-start gap-4">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="absolute -right-1.5 -top-1.5 rounded-full border border-[#1b1b1b] bg-primary px-1.5 py-0.5 text-[9px] font-black leading-none text-black">
              {number}
            </span>
          </div>
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="font-display text-lg font-semibold tracking-tight text-white sm:text-xl">
              {title}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-400">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

export function TournamentBuilderField({
  htmlFor,
  label,
  description,
  required,
  children,
  className,
}: {
  htmlFor?: string;
  label: string;
  description?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="font-semibold text-zinc-100">
          {label}
        </Label>
        {required ? <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Обязательно</span> : null}
      </div>
      {children}
      {description ? <p className="text-xs leading-5 text-zinc-500">{description}</p> : null}
    </div>
  );
}

export function TournamentBuilderToggle({
  name,
  value = "true",
  title,
  description,
  defaultChecked,
  tone = "neutral",
  className,
}: {
  name: string;
  value?: string;
  title: string;
  description?: string;
  defaultChecked?: boolean;
  tone?: "neutral" | "primary" | "warning";
  className?: string;
}) {
  const toneClass =
    tone === "primary"
      ? "border-primary/20 bg-primary/[0.07] hover:border-primary/35"
      : tone === "warning"
        ? "border-amber-300/20 bg-amber-300/[0.06] hover:border-amber-300/35"
        : "border-white/10 bg-black/20 hover:border-white/20";

  return (
    <label className={cn("flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border p-4 transition duration-200", toneClass, className)}>
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/20 bg-black accent-primary focus-visible:ring-2 focus-visible:ring-primary"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-5 text-white">{title}</span>
        {description ? <span className="mt-1 block text-xs leading-5 text-zinc-400">{description}</span> : null}
      </span>
    </label>
  );
}

export function TournamentBuilderChoice({
  title,
  description,
  icon: Icon,
  className,
  ...inputProps
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & {
  title: string;
  description: string;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <label className={cn("group relative min-w-0 cursor-pointer", className)}>
      <input type="radio" className="peer sr-only" {...inputProps} />
      <span className="flex h-full min-h-[104px] flex-col rounded-xl border border-white/10 bg-black/20 p-4 transition duration-200 group-hover:border-white/20 peer-checked:border-primary/55 peer-checked:bg-primary/[0.08] peer-checked:[&_.choice-icon]:border-primary/25 peer-checked:[&_.choice-icon]:bg-primary/10 peer-checked:[&_.choice-icon]:text-primary peer-checked:[&_.choice-indicator]:border-primary peer-checked:[&_.choice-indicator]:bg-primary peer-checked:[&_.choice-indicator]:text-black peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#1b1b1b]">
        <span className="flex items-start justify-between gap-3">
          <span className="choice-icon flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400 transition">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="choice-indicator flex h-5 w-5 items-center justify-center rounded-full border border-white/15 text-transparent transition">
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
          </span>
        </span>
        <span className="mt-3 block text-sm font-semibold text-white">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-zinc-500">{description}</span>
      </span>
    </label>
  );
}

export function TournamentBuilderNotice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm leading-6 text-zinc-300", className)}>
      {children}
    </div>
  );
}
