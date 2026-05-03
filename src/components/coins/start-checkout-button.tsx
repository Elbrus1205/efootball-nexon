"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function StartCheckoutButton({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Button asChild size="lg" className={className}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
