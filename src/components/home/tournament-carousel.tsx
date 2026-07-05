"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Trophy, Users } from "lucide-react";
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

export function TournamentCarousel({ tournaments }: { tournaments: CarouselTournament[] }) {
  const trackRef = useRef<HTMLUListElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const syncEdges = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    setAtStart(track.scrollLeft <= 4);
    setAtEnd(track.scrollLeft >= max - 4);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    syncEdges();
    track.addEventListener("scroll", syncEdges, { passive: true });
    window.addEventListener("resize", syncEdges);
    return () => {
      track.removeEventListener("scroll", syncEdges);
      window.removeEventListener("resize", syncEdges);
    };
  }, [syncEdges]);

  const scrollByCard = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>("li");
    const step = card ? card.offsetWidth + 20 : track.clientWidth * 0.8;
    track.scrollBy({ left: step * direction, behavior: "smooth" });
  };

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
    <div className={styles["home-fx-carousel"]}>
      <button
        type="button"
        className={`${styles["home-fx-arrow"]} ${styles["home-fx-arrow-prev"]}`}
        onClick={() => scrollByCard(-1)}
        disabled={atStart}
        aria-label="Предыдущие турниры"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <ul className={styles["home-fx-track"]} ref={trackRef}>
        {tournaments.map((tournament) => {
          const fill = Math.min(100, Math.round((tournament.participants / Math.max(1, tournament.maxParticipants)) * 100));
          return (
            <li key={tournament.id} className={styles["home-fx-card"]}>
              <Link href={`/tournaments/${tournament.slug}`} className={styles["home-fx-card-link"]}>
                <div className={styles["home-fx-card-media"]}>
                  {tournament.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tournament.coverUrl} alt="" loading="lazy" className={styles["home-fx-card-cover"]} />
                  ) : (
                    <div className={styles["home-fx-card-fallback"]} aria-hidden="true">
                      <Trophy className="h-8 w-8" />
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
                        "Призовой фонд уточняется"
                      )}
                    </span>
                    <span className={styles["home-fx-card-cta"]}>
                      Открыть
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className={`${styles["home-fx-arrow"]} ${styles["home-fx-arrow-next"]}`}
        onClick={() => scrollByCard(1)}
        disabled={atEnd}
        aria-label="Следующие турниры"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
