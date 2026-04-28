import { AuthForm } from "@/components/auth/auth-form";

export default function RegisterPage({
  searchParams,
}: {
  searchParams?: { telegramToken?: string; telegramError?: string };
}) {
  const telegramEnabled = Boolean(process.env.TELEGRAM_CLIENT_ID && process.env.TELEGRAM_CLIENT_SECRET);
  const vkAppId = process.env.NEXT_PUBLIC_VK_APP_ID ?? process.env.VK_CLIENT_ID;

  return (
    <div className="page-shell py-12">
      <AuthForm
        type="register"
        telegramEnabled={telegramEnabled}
        telegramCompletionToken={searchParams?.telegramToken}
        telegramError={searchParams?.telegramError}
        vkAppId={vkAppId}
      />
    </div>
  );
}
