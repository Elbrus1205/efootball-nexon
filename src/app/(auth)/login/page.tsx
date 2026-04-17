import { AuthForm } from "@/components/auth/auth-form";
import { Card } from "@/components/ui/card";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { banned?: string };
}) {
  return (
    <div className="page-shell space-y-4 py-12">
      {searchParams?.banned ? (
        <Card className="mx-auto w-full max-w-md border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-100">
          Аккаунт заблокирован навсегда. Вход закрыт.
        </Card>
      ) : null}
      <AuthForm type="login" />
    </div>
  );
}
