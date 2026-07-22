"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Client-side tab link with instant press feedback. `?tab=` navigations don't
 * trigger loading.tsx, so without this the UI looks frozen until the server
 * responds. useLinkStatus exposes the pending state the moment the link is
 * tapped, letting us dim + show a spinner immediately.
 */
export function TournamentTabLink({
  href,
  active,
  className,
  pendingClassName,
  children,
}: {
  href: string;
  active: boolean;
  className?: string;
  pendingClassName?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={className}
    >
      <TabPending pendingClassName={pendingClassName} />
      {children}
    </Link>
  );
}

function TabPending({ pendingClassName }: { pendingClassName?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-primary/10",
        pendingClassName,
      )}
    >
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
    </span>
  );
}
