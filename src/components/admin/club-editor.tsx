"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Check, CircleHelp, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

type League = { id: string; slug: string; name: string; badgePath: string; isEnabled: boolean };
type Club = { id: string; slug: string; name: string; imagePath: string; isRegistrationEnabled: boolean; isInGameEnabled: boolean; leagueId: string | null };

export function ClubEditor({ leagues, clubs }: { leagues: League[]; clubs: Club[] }) {
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(clubs);
  const [pending, setPending] = useState<string | null>(null);
  const filtered = useMemo(() => items.filter((club) => (leagueFilter === "all" || club.leagueId === leagueFilter) && (!query.trim() || `${club.name} ${club.slug}`.toLowerCase().includes(query.trim().toLowerCase()))), [items, leagueFilter, query]);

  const toggle = async (club: Club, field: "isRegistrationEnabled" | "isInGameEnabled") => {
    const value = !club[field];
    setPending(`${club.id}:${field}`);
    setItems((current) => current.map((item) => item.id === club.id ? { ...item, [field]: value } : item));
    try {
      const response = await fetch("/api/admin/clubs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: club.id, [field]: value }) });
      if (!response.ok) throw new Error("update failed");
    } catch {
      setItems((current) => current.map((item) => item.id === club.id ? { ...item, [field]: !value } : item));
    } finally { setPending(null); }
  };

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#191919] p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input aria-label="Поиск клуба" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название или slug клуба" className="h-11 w-full rounded-xl border border-white/10 bg-black/25 pl-10 pr-3 text-sm text-white outline-none focus:border-primary/50" /></div>
      <div className="flex gap-2 overflow-x-auto pb-1"><Button type="button" variant={leagueFilter === "all" ? "secondary" : "outline"} className="min-h-11 shrink-0" onClick={() => setLeagueFilter("all")}>Все клубы</Button>{leagues.map((league) => <Button key={league.id} type="button" variant={leagueFilter === league.id ? "secondary" : "outline"} className="min-h-11 shrink-0 gap-2" onClick={() => setLeagueFilter(league.id)}><Image src={league.badgePath} alt={`Эмблема ${league.name}`} width={24} height={24} className="h-6 w-6 object-contain" />{league.name}</Button>)}</div>
    </div>
    <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] p-3 text-sm text-zinc-300"><CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>«Регистрация» управляет списком выбора игрока. «В игре» оставляет клуб доступным для турниров, которые используют фильтр клубов из игры.</span></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((club) => <div key={club.id} className="rounded-2xl border border-white/10 bg-[#171c1d] p-4"><div className="flex items-center gap-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/25"><Image src={club.imagePath} alt={`Эмблема ${club.name}`} width={48} height={48} className="h-12 w-12 object-contain" /></div><div className="min-w-0"><div className="truncate font-semibold text-white">{club.name}</div><div className="truncate text-xs text-zinc-500">{club.slug}</div></div></div><div className="mt-4 grid grid-cols-2 gap-2"><Button type="button" variant={club.isRegistrationEnabled ? "secondary" : "outline"} className="min-h-11 gap-1.5 text-xs" onClick={() => toggle(club, "isRegistrationEnabled")} disabled={pending === `${club.id}:isRegistrationEnabled`}>{pending === `${club.id}:isRegistrationEnabled` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : club.isRegistrationEnabled ? <Check className="h-3.5 w-3.5" /> : null} Регистрация</Button><Button type="button" variant={club.isInGameEnabled ? "secondary" : "outline"} className="min-h-11 gap-1.5 text-xs" onClick={() => toggle(club, "isInGameEnabled")} disabled={pending === `${club.id}:isInGameEnabled`}>{pending === `${club.id}:isInGameEnabled` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : club.isInGameEnabled ? <Check className="h-3.5 w-3.5" /> : null} В игре</Button></div></div>)}</div>
    {!filtered.length ? <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">Клубы не найдены.</div> : null}
  </div>;
}
