"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { WHITE_STORE_TELEGRAM_REFERRAL_URL } from "@/lib/white-store";

export function StartCheckoutButton({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Button asChild size="lg" className={className}>
      <a href={WHITE_STORE_TELEGRAM_REFERRAL_URL}>{children}</a>
    </Button>
  );
}
