"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronRight, Swords } from "lucide-react";
import { useEffect, useRef } from "react";
import s from "@/app/home.module.css";
import { InstallAppButton } from "@/components/home/install-app-button";

interface AnimatedBrandHeroProps {
  telegramHref: string;
}

function BrandWordmark3D() {
  return (
    <div className={s.brandFloat}>
      <h1 id="hero-title" className={s.brandWordmark} aria-label="EFOOTBALL NEXON">
        <span className={s.efootballWord} data-text="EFOOTBALL" aria-hidden="true">EFOOTBALL</span>
        <span className={s.nexonWord} data-text="NEXON" aria-hidden="true">NEXON</span>
      </h1>
    </div>
  );
}

export function AnimatedBrandHero({ telegramHref }: AnimatedBrandHeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse), (prefers-reduced-motion: reduce)").matches) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (animationFrameRef.current !== null) return;
      animationFrameRef.current = window.requestAnimationFrame(() => {
        const element = heroRef.current?.closest<HTMLElement>("section");
        if (element) {
          element.style.setProperty("--pointer-x", String((event.clientX / window.innerWidth - 0.5) * 2));
          element.style.setProperty("--pointer-y", String((event.clientY / window.innerHeight - 0.5) * 2));
        }
        animationFrameRef.current = null;
      });
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  return (
    <div ref={heroRef} className={s.heroLayout}>
      <div className={s.heroAtmosphere} aria-hidden="true">
        <span className={s.stadiumHalo} />
        <span className={`${s.stadiumLight} ${s.stadiumLightLeft}`} />
        <span className={`${s.stadiumLight} ${s.stadiumLightRight}`} />
        <span className={s.stadiumStand} />
        <span className={s.stadiumPitch} />
        <span className={s.stadiumMist} />
        <div className={s.particles}>{Array.from({ length: 24 }, (_, index) => <i key={index} />)}</div>
        <svg className={s.fieldLines} viewBox="0 0 1200 620" fill="none">
          <path d="M130 545h940M250 485h700M600 120v420M330 420c0-92 121-166 270-166s270 74 270 166M470 545V436c0-35 58-63 130-63s130 28 130 63v109M470 545V485h260v60" />
          <circle cx="600" cy="420" r="58" />
        </svg>
      </div>

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
        <p className={s.kicker}><span /> Турнирная экосистема eFootball Mobile</p>
        <p className={s.heroLead}>Турниры, рейтинги и матч-дни в одном ритме. Входи в сетку, играй на результат и поднимайся выше.</p>
        <div className={s.actions}>
          <Link href="/tournaments" className={s.primaryButton}>
            <Swords aria-hidden="true" />
            Смотреть турниры
            <ChevronRight aria-hidden="true" />
          </Link>
          <InstallAppButton />
          <Link href={telegramHref} target="_blank" rel="noreferrer" className={s.textButton}>
            Следить за сезоном <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
