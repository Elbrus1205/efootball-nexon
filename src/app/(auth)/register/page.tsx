import { AuthForm } from "@/components/auth/auth-form";

export default function RegisterPage() {
  const telegramBotId = process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID ?? process.env.TELEGRAM_BOT_TOKEN?.split(":")[0];
  const telegramBotUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? process.env.TELEGRAM_BOT_USERNAME;

  return (
    <div className="page-shell py-12">
      <AuthForm type="register" telegramBotId={telegramBotId} telegramBotUsername={telegramBotUsername} />
    </div>
  );
}
