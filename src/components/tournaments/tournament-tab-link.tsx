"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Prefetch the complete dynamic route so switching `?tab=` values can reuse
 * the RSC payload immediately instead of waiting for a request after the tap.
 */
export function TournamentTabLink({
  href,
  active,
  className,
  children,
}: {
  href: string;
  active: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={true}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={className}
    >
      {children}
    </Link>
  );
}
