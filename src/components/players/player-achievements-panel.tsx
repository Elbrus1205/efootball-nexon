import Image from "next/image";
import { Check, ChevronDown, Flag, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import type { AchievementGroupProgress } from "@/lib/achievements";
import styles from "./player-achievements.module.css";

function number(value: number) { return new Intl.NumberFormat("ru-RU").format(value); }

export function PlayerAchievementsPanel({ achievements }: { achievements: AchievementGroupProgress[] }) {
  const unlocked = achievements.reduce((sum, group) => sum + group.unlockedCount, 0);
  const total = achievements.reduce((sum, group) => sum + group.totalCount, 0);
  const percent = total ? Math.round(unlocked / total * 100) : 0;

  return (
    <div className={styles.panel}>
      <div className={styles.overview}>
        <span className={styles.overviewIcon}><Trophy size={25} strokeWidth={1.4} aria-hidden="true" /></span>
        <div className={styles.overviewCopy}><h2>Коллекция достижений</h2><p>Открыто {unlocked} из {total}</p></div>
        <span className={styles.percent}>{percent}<small>%</small></span>
        <div className={styles.overviewTrack} aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
      </div>
      <div className={styles.grid}>
        {achievements.map((group) => {
          const Icon = group.key === "registered" ? Sparkles : group.key === "played" ? Flag : group.key === "clean_sheets" ? ShieldCheck : Trophy;
          const progress = group.nextLevel ? Math.min(100, Math.round(group.value / group.nextLevel.target * 100)) : 100;
          return (
            <details key={group.key} className={styles.card}>
              <summary className={styles.summary}>
                {group.imagePath ? (
                  <div className={styles.image}><Image src={group.imagePath} alt={group.currentLevel?.title ?? group.title} width={800} height={160} sizes="(min-width: 640px) 500px, 100vw" className="h-auto w-full object-contain" /></div>
                ) : null}
                <div className={styles.heading}>
                  <span className={styles.icon}><Icon size={20} strokeWidth={1.5} aria-hidden="true" /></span>
                  <div><h3>{group.title}</h3><p>{group.unlockedCount} / {group.totalCount} уровней</p></div>
                  <ChevronDown size={16} className={styles.chevron} aria-hidden="true" />
                </div>
                <div className={styles.metric}><span>{group.metricLabel}</span><strong>{number(group.value)}{group.nextLevel ? <small> / {number(group.nextLevel.target)}</small> : null}</strong></div>
                <div className={styles.track} aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
                <p className={styles.hint}>{group.nextLevel ? `До следующего уровня: ${number(Math.max(0, group.nextLevel.target - group.value))}` : "Все уровни открыты"}</p>
              </summary>
              <div className={styles.levels}>
                {group.levels.map((level) => (
                  <div key={level.key} className={styles.level} data-unlocked={level.unlocked}>
                    <span className={styles.check} aria-label={level.unlocked ? "Открыто" : "Пока закрыто"}>{level.unlocked ? <Check size={12} /> : null}</span>
                    <div className={styles.levelCopy}>
                      <div className={styles.levelTitle}>{level.shortTitle}</div>
                      <div className={styles.track} aria-hidden="true"><span style={{ width: `${level.progressPercent}%` }} /></div>
                    </div>
                    <span className={styles.levelValue}>{number(Math.min(level.value, level.target))} / {number(level.target)}</span>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
