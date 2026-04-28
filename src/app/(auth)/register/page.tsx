import { AuthForm } from "@/components/auth/auth-form";

export default function RegisterPage() {
  const telegramBotUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? process.env.TELEGRAM_BOT_USERNAME;
  const vkAppId = process.env.NEXT_PUBLIC_VK_APP_ID ?? process.env.VK_CLIENT_ID;

  return (
    <div className="page-shell py-12">
      <AuthForm type="register" telegramBotUsername={telegramBotUsername} vkAppId={vkAppId} />
    </div>
  );
}
