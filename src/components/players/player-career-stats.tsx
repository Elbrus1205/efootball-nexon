import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import type { PlayerCareerStats } from "@/lib/player-stats";
import styles from "./player-profile.module.css";

function formatGoalDifference(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

type PlayerCareerStatsPanelProps = {
  stats: PlayerCareerStats;
  periodLabel?: string;
  periodControl?: ReactNode;
};

export function PlayerCareerStatsPanel({ stats, periodLabel = "За всё время", periodControl }: PlayerCareerStatsPanelProps) {
  const results = [
    { label: "Победы", value: stats.wins, tone: "win" },
    { label: "Ничьи", value: stats.draws, tone: "draw" },
    { label: "Поражения", value: stats.losses, tone: "loss" },
  ];
  const goals = [
    { label: "Забито", value: stats.goalsFor },
    { label: "Пропущено", value: stats.goalsAgainst },
    { label: "Разница мячей", value: formatGoalDifference(stats.goalDifference) },
    { label: "Матчи без пропущенных", value: stats.cleanSheets },
  ];

  return (
    <section className={styles.statsSection} aria-labelledby="profile-stats-heading">
      <h2 id="profile-stats-heading" className={styles.groupTitle}>Статистика игрока</h2>
      <Card className={`${styles.panel} ${styles.statsPanel}`}>
        <div className={styles.statsHeading}>
          <p className={styles.caption}>{periodLabel}</p>
          {periodControl}
        </div>
        <dl className={styles.statsSummary}>
          <div><dt>Матчей сыграно</dt><dd>{stats.played}</dd></div>
          <div><dt>Винрейт</dt><dd>{stats.winRate}<span>%</span></dd></div>
        </dl>
        <div className={styles.resultBar} aria-hidden="true">
          {results.map((item) => <span key={item.tone} data-tone={item.tone} style={{ flexGrow: item.value }} />)}
        </div>
        <dl className={styles.results}>
          {results.map((item) => (
            <div key={item.label} className={styles.result} data-tone={item.tone}>
              <dt><span className={styles.resultDot} aria-hidden="true" />{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
        <dl className={styles.goalList}>
          {goals.map((item) => <div key={item.label} className={styles.detailRow}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        </dl>
        <p className={styles.statsNote}>
          {stats.played ? "Учитываются подтверждённые матчи без отдельных пенальти-серий." : "Статистика появится после подтверждения первых результатов."}
        </p>
      </Card>
    </section>
  );
}
