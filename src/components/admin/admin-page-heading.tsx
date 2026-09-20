"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

/** Content tools need the space for the editor, especially on a phone. */
export function AdminPageHeading({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname !== "/admin/faq") return children;

  return (
    <div className="flex min-h-8 items-center gap-2 text-sm text-zinc-400">
      <h1 className="text-sm font-normal text-zinc-300">Панель управления</h1>
      <ChevronRight size={14} aria-hidden="true" />
      <span>FAQ</span>
    </div>
  );
}
