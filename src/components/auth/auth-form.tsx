"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { TelegramLogin } from "@/components/auth/telegram-login";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startVkIdAuth } from "@/lib/vkid-client";

export function AuthForm({ type }: { type: "login" | "register" }) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [twoFactorStep, setTwoFactorStep] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const router = useRouter();

  const startVkAuth = (callbackPath: string) => {
    startTransition(async () => {
      try {
        if (typeof window === "undefined") return;

        const host = window.location.hostname.toLowerCase();
        const protocol = window.location.protocol;
        const canonicalOrigin =
          host === "efootball-nexon.ru" ? `${protocol}//www.efootball-nexon.ru` : window.location.origin;

        await startVkIdAuth({
          mode: "auth",
          callbackUrl: `${canonicalOrigin}${callbackPath}`,
        });
      } catch {
        toast.error("Не удалось запустить вход через VK.");
      }
    });
  };

  const submit = () => {
    startTransition(async () => {
      try {
        const normalizedEmail = email.trim().toLowerCase();

        if (type === "register") {
          const res = await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: normalizedEmail, password, name }),
          });

          if (!res.ok) {
            const payload = await res.json().catch(() => null);
            toast.error(payload?.error || "Не удалось создать аккаунт");
            return;
          }
        }

        if (type === "login" && !twoFactorStep) {
          const preflight = await fetch("/api/auth/credentials/preflight", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: normalizedEmail,
              password,
            }),
          });

          const preflightPayload = await preflight.json().catch(() => null);
          if (!preflight.ok) {
            toast.error(preflightPayload?.error || "Неверный email или пароль");
            return;
          }

          if (preflightPayload?.requiresTwoFactor) {
            setChallengeToken(preflightPayload.challengeToken ?? "");
            setTwoFactorStep(true);
            toast.success("Код отправлен в Telegram-бот. Введите его для завершения входа.");
            return;
          }
        }

        const result = await signIn("credentials", {
          email: normalizedEmail,
          password,
          twoFactorCode: twoFactorStep ? twoFactorCode : undefined,
          challengeToken: twoFactorStep ? challengeToken : undefined,
          redirect: false,
        });

        if (!result) {
          toast.error("Не удалось выполнить вход. Попробуйте ещё раз.");
          return;
        }

        if (result.error) {
          toast.error(twoFactorStep ? "Неверный код из Telegram или он уже истёк." : "Неверный email или пароль");
          return;
        }

        setTwoFactorStep(false);
        setTwoFactorCode("");
        setChallengeToken("");
        toast.success(type === "register" ? "Аккаунт создан" : "Вход выполнен");
        router.push("/dashboard");
        router.refresh();
      } catch {
        toast.error("Не удалось выполнить вход. Попробуйте ещё раз.");
      }
    });
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {type === "login"
            ? twoFactorStep
              ? "Подтверждение входа"
              : "Вход в eFootball Nexon"
            : "Регистрация игрока"}
        </CardTitle>
        <CardDescription>
          {type === "login"
            ? twoFactorStep
              ? "Введите код, который бот отправил вам в Telegram."
              : "Войдите через email, VK или Telegram."
            : "Создайте аккаунт, чтобы регистрироваться на турниры и отправлять результаты."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {type === "register" ? (
          <div className="space-y-2">
            <Label htmlFor="name">Имя</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
        ) : null}

        {!twoFactorStep ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="twoFactorCode">Код из Telegram</Label>
            <Input
              id="twoFactorCode"
              inputMode="numeric"
              placeholder="Введите 6-значный код"
              value={twoFactorCode}
              onChange={(event) => setTwoFactorCode(event.target.value)}
            />
          </div>
        )}

        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Подождите..." : type === "login" ? (twoFactorStep ? "Подтвердить вход" : "Войти") : "Создать аккаунт"}
        </Button>

        {type === "login" && twoFactorStep ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setTwoFactorStep(false);
              setTwoFactorCode("");
              setChallengeToken("");
            }}
          >
            Назад
          </Button>
        ) : null}

        {!twoFactorStep ? (
          <>
            <div className="grid gap-3">
              <Button variant="secondary" className="w-full" onClick={() => startVkAuth("/dashboard")}>
                Продолжить через VK
              </Button>
              <TelegramLogin botUsername={process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME} />
            </div>

            <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-zinc-400">
              {type === "register" ? "Нажимая «Создать аккаунт» или продолжая через VK/Telegram, вы принимаете " : "Продолжая вход, вы принимаете "}
              <Link className="text-primary transition hover:text-white" href="/terms">
                пользовательское соглашение
              </Link>
              {", "}
              <Link className="text-primary transition hover:text-white" href="/privacy">
                политику конфиденциальности
              </Link>
              {" и "}
              <Link className="text-primary transition hover:text-white" href="/consent">
                согласие на обработку данных
              </Link>
              .
            </p>

            <div className="text-sm text-zinc-400">
              {type === "login" ? (
                <>
                  Нет аккаунта?{" "}
                  <Link className="text-primary" href="/register">
                    Зарегистрироваться
                  </Link>
                </>
              ) : (
                <>
                  Уже есть аккаунт?{" "}
                  <Link className="text-primary" href="/login">
                    Войти
                  </Link>
                </>
              )}
            </div>

            {type === "login" ? (
              <Link href="/forgot-password" className="inline-block text-sm text-primary">
                Забыли пароль?
              </Link>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
