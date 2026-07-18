import Link from "next/link";
import { ArrowUpRight, ChevronRight, Swords } from "lucide-react";
import s from "@/app/home.module.css";
import { InstallAppButton } from "@/components/home/install-app-button";

const efootballLetters = Array.from("EFOOTBALL");

interface AnimatedBrandHeroProps {
  telegramHref: string;
}

function BrandWordmark3D() {
  return (
    <div className={s.brandFloat}>
      <h1
        id="hero-title"
        className={s.brandWordmark}
        aria-label="EFOOTBALL NEXON"
      >
        <span className={s.efootballWord} data-text="EFOOTBALL" aria-hidden="true">
          {efootballLetters.map((letter, index) => (
            <span
              className={s.brandLetter}
              key={`${letter}-${index}`}
            >
              {letter}
            </span>
          ))}
        </span>

        <span
          className={s.nexonWord}
          data-text="NEXON"
          aria-hidden="true"
        >
          NEXON
        </span>
      </h1>
    </div>
  );
}

export function AnimatedBrandHero({ telegramHref }: AnimatedBrandHeroProps) {
  return (
    <div className={s.heroLayout}>
      <div className={s.brandScene}>
        <div className={s.brandBackdrop} aria-hidden="true">
          <span className={s.brandOrbit} />
          <span className={s.brandAxis} />
          <span className={s.brandHorizon} />
        </div>
        <BrandWordmark3D />
        <div className={s.brandCoordinates} aria-hidden="true">
          <span>NEX / 2026</span>
          <span>COMPETITIVE MOBILE FOOTBALL</span>
        </div>
      </div>

      <div className={s.heroCopy}>
        <p className={s.kicker}><span /> Турниры по eFootball Mobile</p>
        <p className={s.heroLead}>
          Соревнуйся, отправляй результаты и проходи путь от регистрации до финала на одной платформе.
        </p>
        <div className={s.actions}>
          <Link href="/tournaments" className={s.primaryButton}>
            <Swords aria-hidden="true" />
            Смотреть турниры
            <ChevronRight aria-hidden="true" />
          </Link>
          <InstallAppButton />
          <Link href={telegramHref} target="_blank" rel="noreferrer" className={s.textButton}>
            Telegram-сообщество <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
