"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "@/app/home.module.css";

/**
 * Continuous auto-scrolling row. Renders the children twice so the loop is
 * seamless, advances scrollLeft each frame, and pauses while the visitor
 * hovers, drags, or swipes. Disabled entirely under reduced-motion, where it
 * degrades to a normal swipeable row.
 */
export function AutoScrollRow({
  children,
  ariaLabel,
  speed = 0.4,
}: {
  children: ReactNode;
  ariaLabel: string;
  speed?: number;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let paused = false;
    let resumeTimer: ReturnType<typeof setTimeout> | undefined;

    const step = () => {
      if (!paused) {
        const half = el.scrollWidth / 2;
        if (half > 0) {
          el.scrollLeft += speed;
          if (el.scrollLeft >= half) el.scrollLeft -= half;
        }
      }
      raf = requestAnimationFrame(step);
    };

    const pause = () => {
      paused = true;
      if (resumeTimer) clearTimeout(resumeTimer);
    };
    const resume = () => {
      paused = false;
    };
    const resumeSoon = () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(resume, 1800);
    };

    el.addEventListener("pointerenter", pause);
    el.addEventListener("pointerleave", resume);
    el.addEventListener("pointerdown", pause);
    el.addEventListener("pointerup", resumeSoon);
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("touchend", resumeSoon, { passive: true });

    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      if (resumeTimer) clearTimeout(resumeTimer);
      el.removeEventListener("pointerenter", pause);
      el.removeEventListener("pointerleave", resume);
      el.removeEventListener("pointerdown", pause);
      el.removeEventListener("pointerup", resumeSoon);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchend", resumeSoon);
    };
  }, [speed]);

  return (
    <div className={styles["auto-row"]} ref={scrollerRef} role="list" aria-label={ariaLabel}>
      <div className={styles["auto-row-group"]}>{children}</div>
      <div className={styles["auto-row-group"]} aria-hidden="true">
        {children}
      </div>
    </div>
  );
}
