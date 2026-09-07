"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: number;
  className?: string;
}

export function AnimatedCounter({ value, className }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const elementRef = useRef<HTMLSpanElement>(null);
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || hasPlayedRef.current) return;

    const finish = () => {
      hasPlayedRef.current = true;
      setDisplayValue(value);
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || hasPlayedRef.current) return;

      hasPlayedRef.current = true;
      const startedAt = performance.now();
      const duration = 900;
      const animate = (timestamp: number) => {
        const progress = Math.min((timestamp - startedAt) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(Math.round(value * eased));
        if (progress < 1) window.requestAnimationFrame(animate);
      };

      window.requestAnimationFrame(animate);
      observer.disconnect();
    }, { threshold: 0.35 });

    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);

  return <span ref={elementRef} className={className}>{new Intl.NumberFormat("ru-RU").format(displayValue)}</span>;
}
