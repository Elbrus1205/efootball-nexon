"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

const storageKey = "efootball-nexon:time-zone-reported";

export function TimeZoneReporter() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZone) return;

    const today = new Date().toISOString().slice(0, 10);
    const marker = `${timeZone}:${today}`;
    if (window.localStorage.getItem(storageKey) === marker) return;

    fetch("/api/profile/time-zone", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeZone }),
    })
      .then((response) => {
        if (response.ok) {
          window.localStorage.setItem(storageKey, marker);
        }
      })
      .catch(() => undefined);
  }, [status]);

  return null;
}
