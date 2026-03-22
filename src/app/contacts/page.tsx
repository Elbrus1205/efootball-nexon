import { Card } from "@/components/ui/card";

export default function ContactsPage() {
  return (
    <div className="page-shell">
      <Card className="space-y-4 p-6">
        <h1 className="font-display text-3xl font-thin text-white">Контакты</h1>
        <p className="text-zinc-400">Telegram: `@your_tournament_admin` • Email: `support@example.com` • VK: `vk.com/yourclub`.</p>
      </Card>
    </div>
  );
}
