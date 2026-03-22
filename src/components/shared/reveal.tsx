"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.18 },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal-base", visible && "reveal-visible", className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
