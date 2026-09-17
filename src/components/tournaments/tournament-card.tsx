import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarDays, Trophy, Users } from "lucide-react";
import { TournamentStatus } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils";
import styles from "./tournament-catalog.module.css";

const statusMap: Record<TournamentStatus, string> = {
  DRAFT: "Скоро открытие",
  REGISTRATION_OPEN: "Регистрация открыта",
  REGISTRATION_CLOSED: "Набор закрыт",
  AWAITING_START: "Ожидает старта",
  IN_PROGRESS: "Идёт турнир",
  COMPLETED: "Завершён",
};

export type TournamentCardTournament = {
  id: string;
  title: string;
  status: TournamentStatus;
  startsAt: Date | string;
  endsAt: Date | string | null;
  maxParticipants: number;
  prizePool: string | null;
  coverImage: string | null;
};

export function TournamentCard({
  tournament,
  participantsCount,
  priorityImage = false,
}: {
  tournament: TournamentCardTournament;
  participantsCount: number;
  priorityImage?: boolean;
}) {
  const completed = tournament.status === TournamentStatus.COMPLETED;
  const registrationOpen = tournament.status === TournamentStatus.REGISTRATION_OPEN;
  const full = participantsCount >= tournament.maxParticipants;
  const canJoin = registrationOpen && !full;
  const date = completed && tournament.endsAt ? tournament.endsAt : tournament.startsAt;
  const dateLabel = completed && tournament.endsAt ? "Завершение" : "Начало";

  return (
    <Link href={`/tournaments/${tournament.id}`} className={styles.cardLink} prefetch={false}>
      <Card className={styles.card}>
        <div className={styles.cardTop}>
          <div className={styles.cover}>
            {tournament.coverImage ? (
              <Image src={tournament.coverImage} alt="" fill unoptimized
                sizes="(min-width: 1280px) 384px, (min-width: 768px) 50vw, 88px"
                priority={priorityImage} fetchPriority={priorityImage ? "high" : undefined}
                className={styles.coverImage} />
            ) : <Trophy className={styles.coverPlaceholder} aria-hidden="true" strokeWidth={1.25} />}
          </div>
          <div className={styles.heading}>
            <span className={cn(styles.status, canJoin && styles.statusOpen, tournament.status === TournamentStatus.IN_PROGRESS && styles.statusLive)}>
              {registrationOpen && full ? "Мест больше нет" : statusMap[tournament.status]}
            </span>
            <h2 className={styles.title}>{tournament.title}</h2>
          </div>
        </div>
        <div className={styles.details}>
          <div className={styles.meta}>
            <div><span className={styles.metaLabel}><CalendarDays aria-hidden="true" />{dateLabel}</span><time dateTime={new Date(date).toISOString()}>{formatDate(date, "d MMM yyyy")}</time></div>
            <div><span className={styles.metaLabel}><Users aria-hidden="true" />Участники</span><span className={styles.count}>{participantsCount} <span>/ {tournament.maxParticipants}</span></span></div>
          </div>
          <div className={styles.prize}><span className={styles.metaLabel}><Trophy aria-hidden="true" />Призовой фонд</span><span>{tournament.prizePool || "Уточняется"}</span></div>
          <span className={cn(styles.action, canJoin && styles.actionJoin)}>
            {canJoin ? "Участвовать" : "Перейти в турнир"}<ArrowRight aria-hidden="true" />
          </span>
        </div>
      </Card>
    </Link>
  );
}
