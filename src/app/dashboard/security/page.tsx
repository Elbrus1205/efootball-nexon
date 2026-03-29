import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function DashboardSecurityPage() {
  await requireAuth();

  return (
    <div className="page-shell py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Badge variant="primary">Безопасность</Badge>
        <Card className="rounded-[32px] border border-white/10 bg-[#11151d] p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="space-y-3">
              <h1 className="text-2xl font-semibold text-white">Безопасность профиля</h1>
              <p className="max-w-xl text-sm text-zinc-400">
                Здесь позже появятся настройки пароля, подключённых способов входа и защиты аккаунта.
              </p>
              <Button asChild variant="outline">
                <Link href="/dashboard">Назад к профилю</Link>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
