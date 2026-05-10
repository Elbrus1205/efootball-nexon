import { AuthForm } from "@/components/auth/auth-form";

export default function RegisterPage() {
  const telegramClientId = process.env.TELEGRAM_CLIENT_ID;
  const telegramEnabled = Boolean(telegramClientId);
  const vkAppId = process.env.NEXT_PUBLIC_VK_APP_ID ?? process.env.VK_CLIENT_ID;

  return (
    <div className="page-shell py-6 sm:py-10">
      <AuthForm
        type="register"
        telegramEnabled={telegramEnabled}
        telegramClientId={telegramClientId}
        vkAppId={vkAppId}
      />
    </div>
  );
}
