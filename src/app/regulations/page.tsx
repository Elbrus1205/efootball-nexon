import { Card } from "@/components/ui/card";

export default function RegulationsPage() {
  return (
    <div className="page-shell">
      <Card className="space-y-4 p-6">
        <h1 className="font-display text-3xl font-semibold text-white">Регламент</h1>
        <p className="text-zinc-400">
          Заполните здесь официальный регламент турниров: сроки, подтверждение матчей, правила переигровок, технические поражения и требования к скриншотам.
        </p>
      </Card>
    </div>
  );
}
