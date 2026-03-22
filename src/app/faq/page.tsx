import { Card } from "@/components/ui/card";

export default function FaqPage() {
  return (
    <div className="page-shell">
      <Card className="space-y-4 p-6">
        <h1 className="font-display text-3xl font-thin text-white">FAQ</h1>
        <p className="text-zinc-400">Здесь можно разместить ответы по регистрации, подтверждению матчей и входу через VK/Telegram.</p>
      </Card>
    </div>
  );
}
