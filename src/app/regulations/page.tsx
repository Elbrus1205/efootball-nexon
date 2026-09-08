import { Card } from "@/components/ui/card";
import { getRegulationsText } from "@/lib/regulations";

export default async function RegulationsPage() {
  const regulations = await getRegulationsText();

  return (
    <div className="page-shell py-6 sm:py-10">
      <Card className="mx-auto max-w-4xl overflow-hidden rounded-2xl border-white/10 bg-[#121715] p-0 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
        <div className="border-b border-white/10 bg-gradient-to-r from-[#b99552]/15 via-transparent to-transparent px-5 py-6 sm:px-8 sm:py-8"><div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b56d]">eFootball Nexon · официальный документ</div><h1 className="mt-3 font-display text-3xl font-thin text-white sm:text-4xl">Регламент</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Правила участия в турнирах, матчах и рейтинговой системе.</p></div>
        <div className="whitespace-pre-wrap px-5 py-6 text-left text-sm leading-7 text-zinc-300 sm:px-8 sm:py-8">{regulations}</div>
      </Card>
    </div>
  );
}
