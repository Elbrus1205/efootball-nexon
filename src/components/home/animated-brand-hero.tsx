"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronRight, Swords } from "lucide-react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import s from "@/app/home.module.css";

const efootballLetters = Array.from("EFOOTBALL");

interface AnimatedBrandHeroProps {
  playHref: string;
  telegramHref: string;
  isSignedIn: boolean;
}

function BrandWordmark3D({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className={s.brandFloat}>
      <motion.h1
        id="hero-title"
        className={s.brandWordmark}
        aria-label="EFOOTBALL NEXON"
        initial={reducedMotion ? false : { opacity: 0, scale: 0.96, filter: "blur(12px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className={s.efootballWord} data-text="EFOOTBALL" aria-hidden="true">
          {efootballLetters.map((letter, index) => (
            <motion.span
              className={s.brandLetter}
              key={`${letter}-${index}`}
              initial={reducedMotion ? false : { opacity: 0, y: 14, z: -32, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, z: 0, filter: "blur(0px)" }}
              transition={reducedMotion ? { duration: 0 } : {
                delay: 0.22 + index * 0.045,
                duration: 0.46,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {letter}
            </motion.span>
          ))}
        </span>

        <motion.span
          className={s.nexonWord}
          data-text="NEXON"
          aria-hidden="true"
          initial={reducedMotion ? false : { opacity: 0, y: 22, z: -96, filter: "blur(9px)" }}
          animate={{ opacity: 1, y: 0, z: 34, filter: "blur(0px)" }}
          transition={reducedMotion
            ? { duration: 0 }
            : { delay: 0.62, type: "spring", stiffness: 95, damping: 17, mass: 0.9 }}
        >
          NEXON
        </motion.span>

        {!reducedMotion ? (
          <motion.span
            className={s.heroSweep}
            aria-hidden="true"
            initial={{ x: "-135%", opacity: 0 }}
            animate={{ x: "135%", opacity: [0, 0.72, 0] }}
            transition={{ delay: 1.2, duration: 1.15, ease: [0.45, 0, 0.55, 1] }}
          />
        ) : null}
      </motion.h1>
    </div>
  );
}

export function AnimatedBrandHero({ playHref, telegramHref, isSignedIn }: AnimatedBrandHeroProps) {
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = Boolean(prefersReducedMotion);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const smoothRotateX = useSpring(rotateX, { stiffness: 90, damping: 22, mass: 0.7 });
  const smoothRotateY = useSpring(rotateY, { stiffness: 90, damping: 22, mass: 0.7 });

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || event.pointerType !== "mouse" || !window.matchMedia("(hover: hover)").matches) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5;
    const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;
    rotateY.set(horizontal * 8);
    rotateX.set(vertical * -5);
  };

  const resetParallax = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <div className={s.heroLayout}>
      <motion.div
        className={s.brandScene}
        onPointerMove={handlePointerMove}
        onPointerLeave={resetParallax}
        style={{ rotateX: smoothRotateX, rotateY: smoothRotateY }}
        initial={reducedMotion ? false : { opacity: 0, z: -80, filter: "blur(12px)" }}
        animate={{ opacity: 1, z: 0, filter: "blur(0px)" }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className={s.brandBackdrop} aria-hidden="true">
          <span className={s.brandOrbit} />
          <span className={s.brandAxis} />
          <span className={s.brandHorizon} />
        </div>
        <BrandWordmark3D reducedMotion={reducedMotion} />
        <div className={s.brandCoordinates} aria-hidden="true">
          <span>NEX / 2026</span>
          <span>COMPETITIVE MOBILE FOOTBALL</span>
        </div>
      </motion.div>

      <motion.div
        className={s.heroCopy}
        initial={reducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion
          ? { duration: 0 }
          : { delay: 0.85, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className={s.kicker}><span /> Турниры по eFootball Mobile</p>
        <p className={s.heroLead}>
          Соревнуйся, отправляй результаты и проходи путь от регистрации до финала на одной платформе.
        </p>
        <div className={s.actions}>
          <Link href={playHref} className={s.primaryButton}>
            <Swords aria-hidden="true" />
            {isSignedIn ? "Смотреть турниры" : "Участвовать в турнире"}
            <ChevronRight aria-hidden="true" />
          </Link>
          <Link href={telegramHref} target="_blank" rel="noreferrer" className={s.textButton}>
            Telegram-сообщество <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
