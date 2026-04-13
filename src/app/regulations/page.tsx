import { Card } from "@/components/ui/card";
import { getRegulationsText } from "@/lib/regulations";

export default async function RegulationsPage() {
  const regulations = await getRegulationsText();

  return (
    <div className="page-shell">
      <Card className="space-y-4 p-6">
        <h1 className="font-display text-3xl font-thin text-white">Регламент</h1>
        <div className="whitespace-pre-wrap text-justify leading-7 text-zinc-300">{regulations}</div>
      </Card>
    </div>
  );
}
