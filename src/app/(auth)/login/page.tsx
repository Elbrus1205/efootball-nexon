import { AuthForm } from "@/components/auth/auth-form";
import { Card } from "@/components/ui/card";

export default async function LoginPage(
  props: {
    searchParams?: Promise<{ banned?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const telegramClientId = process.env.TELEGRAM_CLIENT_ID;
  const telegramEnabled = Boolean(telegramClientId);
  const vkAppId = process.env.NEXT_PUBLIC_VK_APP_ID ?? process.env.VK_CLIENT_ID;

  return (
    <div className="page-shell space-y-3 py-6 sm:py-10">
      {searchParams?.banned ? (
        <Card className="mx-auto w-full max-w-md border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-100">
          Аккаунт заблокирован навсегда. Вход закрыт.
        </Card>
      ) : null}
      <AuthForm
        type="login"
        telegramEnabled={telegramEnabled}
        telegramClientId={telegramClientId}
        vkAppId={vkAppId}
      />
    </div>
  );
}
