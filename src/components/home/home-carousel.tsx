"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import s from "@/app/home.module.css";

export function HomeCarousel({ children, count, label, compact = false }: {
  children: ReactNode;
  count: number;
  label: string;
  compact?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ start: number; scroll: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [position, setPosition] = useState({ index: 0, previous: false, next: false });
  const id = useId();

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const left = element.getBoundingClientRect().left;
        const distances = Array.from(element.children).map((child) => Math.abs(child.getBoundingClientRect().left - left));
        setPosition({
          index: Math.max(0, distances.indexOf(Math.min(...distances))),
          previous: element.scrollLeft > 2,
          next: element.scrollLeft + element.clientWidth < element.scrollWidth - 2,
        });
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
    };
  }, [count]);

  function goTo(index: number) {
    const element = track.current;
    const child = element?.children[Math.max(0, Math.min(count - 1, index))];
    if (!element || !child) return;
    element.scrollTo({
      left: element.scrollLeft + child.getBoundingClientRect().left - element.getBoundingClientRect().left,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  return (
    <div className={s.carousel} role="region" aria-roledescription="карусель" aria-label={label}>
      <div id={id} ref={track} className={`${s.carouselTrack} ${compact ? s.compactTrack : ""}`} tabIndex={0}
        aria-label={`${label}. Используйте стрелки для прокрутки.`}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            goTo(event.key === "Home" ? 0 : event.key === "End" ? count - 1 : position.index + (event.key === "ArrowRight" ? 1 : -1));
          }
        }}
        onPointerDown={(event) => {
          suppressClick.current = false;
          if (event.pointerType !== "mouse" || event.button !== 0) return;
          drag.current = { start: event.clientX, scroll: event.currentTarget.scrollLeft, moved: false };
        }}
        onPointerMove={(event) => {
          const current = drag.current;
          if (!current) return;
          const distance = event.clientX - current.start;
          if (Math.abs(distance) > 6) {
            current.moved = true;
            suppressClick.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            event.currentTarget.dataset.dragging = "true";
            event.currentTarget.scrollLeft = current.scroll - distance;
          }
        }}
        onPointerUp={(event) => {
          drag.current = null;
          delete event.currentTarget.dataset.dragging;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={(event) => { drag.current = null; delete event.currentTarget.dataset.dragging; }}
        onPointerLeave={(event) => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) drag.current = null; }}
        onDragStart={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
        }}
      >{children}</div>
      {count > 1 && <div className={s.carouselControls}>
        <div className={s.pagination} aria-label="Выбор карточки">
          {Array.from({ length: count }, (_, index) => <button key={index} type="button" onClick={() => goTo(index)}
            aria-label={`Карточка ${index + 1}`} aria-current={position.index === index ? "true" : undefined} aria-controls={id}><span /></button>)}
        </div>
        <div className={s.carouselArrows}>
          <button type="button" aria-label="Предыдущие карточки" aria-controls={id} disabled={!position.previous} onClick={() => goTo(position.index - 1)}><ArrowLeft aria-hidden="true" /></button>
          <button type="button" aria-label="Следующие карточки" aria-controls={id} disabled={!position.next} onClick={() => goTo(position.index + 1)}><ArrowRight aria-hidden="true" /></button>
        </div>
      </div>}
    </div>
  );
}
