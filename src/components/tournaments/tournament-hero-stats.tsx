"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type HeroStat = {
  label: string;
  value: string;
  /** Если задано — число анимируется count-up до этого значения. */
  countTo?: number;
  /** Текст после анимированного числа, например "/ 32". */
  suffix?: string;
  accent?: boolean;
};

function useInViewOnce(threshold = 0.3) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

function CountUp({ to }: { to: number }) {
  const [value, setValue] = useState(0);
  const { ref, inView } = useInViewOnce(0.4);

  useEffect(() => {
    if (!inView) return;

    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }

    const duration = 1400;
    const start = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(eased * to));
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, to]);

  return (
    <span ref={ref} className="tabular-nums">
      {new Intl.NumberFormat("ru-RU").format(value)}
    </span>
  );
}

export function TournamentHeroStats({ items }: { items: HeroStat[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            "tournament-hero-stat group min-w-0 overflow-hidden rounded-lg border bg-black/20 px-3 py-2.5 transition duration-300",
            item.accent
              ? "border-primary/30 bg-primary/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_24px_rgba(212,175,55,0.12)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_34px_rgba(212,175,55,0.22)]"
              : "border-white/10 hover:border-white/20 hover:bg-white/[0.04]",
          )}
          style={{ animationDelay: `${index * 90}ms` }}
        >
          <div className={cn("text-[10px] font-semibold uppercase tracking-[0.2em]", item.accent ? "text-primary/80" : "text-zinc-500")}>
            {item.label}
          </div>
          <div className={cn("mt-1 truncate text-sm font-semibold", item.accent ? "text-primary" : "text-zinc-100")}>
            {item.countTo !== undefined ? (
              <>
                <CountUp to={item.countTo} />
                {item.suffix ? <span className="text-zinc-500">{item.suffix}</span> : null}
              </>
            ) : (
              item.value
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
