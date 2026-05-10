"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Check, FileText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { TelegramLogin } from "@/components/auth/telegram-login";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startVkIdAuth } from "@/lib/vkid-client";

export function AuthForm({
  type,
  telegramEnabled,
  telegramClientId,
  vkAppId,
}: {
  type: "login" | "register";
  telegramEnabled: boolean;
  telegramClientId?: string;
  vkAppId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [twoFactorStep, setTwoFactorStep] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const router = useRouter();
  const requiresLegalAcceptance = type === "register";
  const externalAuthLegalAccepted = requiresLegalAcceptance ? legalAccepted : true;

  const ensureLegalAccepted = () => {
    if (!requiresLegalAcceptance || legalAccepted) return true;

    toast.error("Сначала примите документы сайта.");
    return false;
  };

  const startVkAuth = (callbackPath: string) => {
    if (!ensureLegalAccepted()) return;

    startTransition(async () => {
      try {
        if (typeof window === "undefined") return;

        await startVkIdAuth({
          mode: "auth",
          callbackUrl: `${window.location.origin}${callbackPath}`,
          legalAccepted: externalAuthLegalAccepted,
        }, vkAppId);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Не удалось запустить вход через VK.");
      }
    });
  };

  const submit = () => {
    startTransition(async () => {
      try {
        const normalizedEmail = email.trim().toLowerCase();

        if (type === "register") {
          if (!ensureLegalAccepted()) return;

          const res = await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: normalizedEmail, password, name, legalAccepted }),
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
    <Card className="mx-auto w-full max-w-[420px] rounded-2xl p-4 sm:p-5">
      <CardHeader className="mb-3 space-y-1">
        <CardTitle className="text-lg leading-tight sm:text-xl">
          {type === "login"
            ? twoFactorStep
              ? "Подтверждение входа"
              : "Вход в eFootball Nexon"
            : "Регистрация игрока"}
        </CardTitle>
        <CardDescription className="text-xs leading-5 sm:text-sm">
          {type === "login"
            ? twoFactorStep
              ? "Введите код, который бот отправил вам в Telegram."
              : "Войдите через email, VK или Telegram."
            : "Создайте аккаунт, чтобы регистрироваться на турниры и отправлять результаты."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {type === "register" ? (
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs">Имя</Label>
            <Input id="name" className="h-10 rounded-lg px-3" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
        ) : null}

        {!twoFactorStep ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input id="email" className="h-10 rounded-lg px-3" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs">Пароль</Label>
              <Input id="password" className="h-10 rounded-lg px-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="twoFactorCode" className="text-xs">Код из Telegram</Label>
            <Input
              id="twoFactorCode"
              className="h-10 rounded-lg px-3"
              inputMode="numeric"
              placeholder="Введите 6-значный код"
              value={twoFactorCode}
              onChange={(event) => setTwoFactorCode(event.target.value)}
            />
          </div>
        )}

        {requiresLegalAcceptance && !twoFactorStep ? (
          <label
            htmlFor="legalAccepted"
            className={`group flex cursor-pointer gap-2.5 rounded-lg border p-2.5 transition ${
              legalAccepted
                ? "border-emerald-300/25 bg-emerald-400/10"
                : "border-white/10 bg-black/20 hover:border-primary/30 hover:bg-white/[0.04]"
            }`}
          >
            <input
              id="legalAccepted"
              type="checkbox"
              checked={legalAccepted}
              onChange={(event) => setLegalAccepted(event.target.checked)}
              className="sr-only"
            />
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                legalAccepted ? "border-emerald-300/35 bg-emerald-400 text-black" : "border-white/15 bg-white/[0.04] text-transparent"
              }`}
            >
              <Check className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-xs font-semibold text-white sm:text-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
                Принимаю документы сайта
              </span>
              <span className="mt-1 block text-[11px] leading-4 text-zinc-400 sm:text-xs sm:leading-5">
                Я принимаю{" "}
                <Link className="text-primary transition hover:text-white" href="/terms">
                  пользовательское соглашение
                </Link>
                {", "}
                <Link className="text-primary transition hover:text-white" href="/privacy">
                  политику конфиденциальности
                </Link>
                {", "}
                <Link className="text-primary transition hover:text-white" href="/consent">
                  согласие на обработку данных
                </Link>
                {" и "}
                <Link className="text-primary transition hover:text-white" href="/cookies">
                  политику cookie
                </Link>
                .
              </span>
            </span>
          </label>
        ) : null}

        <Button className="h-10 w-full rounded-lg" onClick={submit} disabled={pending || (requiresLegalAcceptance && !legalAccepted)}>
          {pending ? "Подождите..." : type === "login" ? (twoFactorStep ? "Подтвердить вход" : "Войти") : "Создать аккаунт"}
        </Button>

        {type === "login" && twoFactorStep ? (
          <Button
            variant="outline"
            className="h-10 w-full rounded-lg"
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
            <div className="grid gap-2.5">
              <Button
                variant="secondary"
                className="h-10 w-full rounded-lg"
                onClick={() => startVkAuth("/dashboard")}
                disabled={pending || (requiresLegalAcceptance && !legalAccepted)}
              >
                Продолжить через VK
              </Button>
              <TelegramLogin
                mode={type}
                enabled={telegramEnabled}
                clientId={telegramClientId}
                legalAccepted={externalAuthLegalAccepted}
                requireLegalAcceptance={requiresLegalAcceptance}
              />
            </div>

            <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] leading-4 text-zinc-400 sm:text-xs sm:leading-5">
              <FileText className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
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

            <div className="text-xs text-zinc-400 sm:text-sm">
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
              <Link href="/forgot-password" className="inline-block text-xs text-primary sm:text-sm">
                Забыли пароль?
              </Link>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
