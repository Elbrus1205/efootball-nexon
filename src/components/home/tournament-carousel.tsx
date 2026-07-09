"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Trophy, Users } from "lucide-react";
import styles from "@/app/home.module.css";

export type CarouselTournament = {
  id: string;
  slug: string;
  title: string;
  statusLabel: string;
  statusTone: "live" | "open" | "soon" | "done";
  dateLabel: string;
  formatLabel: string;
  prizeLabel: string | null;
  participants: number;
  maxParticipants: number;
  coverUrl: string | null;
};

const toneClass: Record<CarouselTournament["statusTone"], string> = {
  live: styles["home-fx-badge-live"],
  open: styles["home-fx-badge-open"],
  soon: styles["home-fx-badge-soon"],
  done: styles["home-fx-badge-done"],
};

function Card({ tournament }: { tournament: CarouselTournament }) {
  const fill = Math.min(100, Math.round((tournament.participants / Math.max(1, tournament.maxParticipants)) * 100));
  return (
    <div className={styles["home-fx-card"]} role="listitem">
      <Link href={`/tournaments/${tournament.slug}`} className={styles["home-fx-card-link"]}>
        <div className={styles["home-fx-card-media"]}>
          {tournament.coverUrl ? (
            <Image
              src={tournament.coverUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 80vw, 316px"
              quality={84}
              className={styles["home-fx-card-cover"]}
            />
          ) : (
            <div className={styles["home-fx-card-fallback"]} aria-hidden="true">
              <Trophy className="h-7 w-7" />
            </div>
          )}
          <span className={`${styles["home-fx-badge"]} ${toneClass[tournament.statusTone]}`}>
            {tournament.statusTone === "live" && <span className={styles["home-fx-badge-dot"]} />}
            {tournament.statusLabel}
          </span>
        </div>

        <div className={styles["home-fx-card-body"]}>
          <span className={styles["home-fx-card-format"]}>{tournament.formatLabel}</span>
          <h3 className={styles["home-fx-card-title"]}>{tournament.title}</h3>

          <div className={styles["home-fx-card-meta"]}>
            <span>{tournament.dateLabel}</span>
            <span className={styles["home-fx-card-players"]}>
              <Users className="h-3.5 w-3.5" />
              {tournament.participants}/{tournament.maxParticipants}
            </span>
          </div>

          <div className={styles["home-fx-card-bar"]} aria-hidden="true">
            <span style={{ width: `${fill}%` }} />
          </div>

          <div className={styles["home-fx-card-foot"]}>
            <span className={styles["home-fx-card-prize"]}>
              {tournament.prizeLabel ? (
                <>
                  <Trophy className="h-3.5 w-3.5" />
                  {tournament.prizeLabel}
                </>
              ) : (
                "Приз уточняется"
              )}
            </span>
            <span className={styles["home-fx-card-cta"]}>
              Открыть
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

export function TournamentCarousel({ tournaments }: { tournaments: CarouselTournament[] }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  // Duplicate for a seamless loop only when there is enough to scroll.
  const loop = tournaments.length > 2;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !loop) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let paused = false;
    let resumeTimer: ReturnType<typeof setTimeout> | undefined;
    const speed = 0.45;

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
  }, [loop]);

  if (tournaments.length === 0) {
    return (
      <div className={styles["home-fx-empty"]}>
        <Trophy className="h-6 w-6" />
        <p>Сейчас нет открытых турниров. Загляни в раздел турниров — расписание обновляется постоянно.</p>
        <Link href="/tournaments" className={styles["home-ghost-button"]}>
          Все турниры
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className={styles["auto-row"]} ref={scrollerRef} role="list" aria-label="Турниры">
      <div className={styles["auto-row-group"]}>
        {tournaments.map((tournament) => (
          <Card key={tournament.id} tournament={tournament} />
        ))}
      </div>
      {loop && (
        <div className={styles["auto-row-group"]} aria-hidden="true">
          {tournaments.map((tournament) => (
            <Card key={`dup-${tournament.id}`} tournament={tournament} />
          ))}
        </div>
      )}
    </div>
  );
}
