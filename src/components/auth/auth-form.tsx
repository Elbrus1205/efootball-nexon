"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { TelegramLogin } from "@/components/auth/telegram-login";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
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
  const [registrationVerificationStep, setRegistrationVerificationStep] = useState(false);
  const [emailCode, setEmailCode] = useState("");
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
            body: JSON.stringify({
              email: normalizedEmail,
              password,
              name,
              legalAccepted,
              emailCode: registrationVerificationStep ? emailCode : undefined,
            }),
          });
          const registerPayload = await res.clone().json().catch(() => null);

          if (!res.ok) {
            const payload = await res.json().catch(() => null);
            toast.error(payload?.error || "Не удалось создать аккаунт");
            return;
          }
          if (registerPayload?.verificationRequired) {
            setRegistrationVerificationStep(true);
            setEmailCode("");
            toast.success("Код подтверждения отправлен на вашу почту.");
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
              fingerprint: await getDeviceFingerprint(),
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
          fingerprint: await getDeviceFingerprint(),
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
        setRegistrationVerificationStep(false);
        setTwoFactorCode("");
        setChallengeToken("");
        setEmailCode("");
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
        {type === "register" && !registrationVerificationStep ? (
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs">Имя</Label>
            <Input
              id="name"
              className="h-10 rounded-lg px-3"
              minLength={3}
              maxLength={16}
              pattern="(?!.*__)[A-Za-z0-9][A-Za-z0-9_]{1,14}[A-Za-z0-9]"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
        ) : null}

        {registrationVerificationStep ? (
          <div className="space-y-2">
            <p className="text-xs leading-5 text-zinc-400">
              Введите код, отправленный на вашу почту. Без подтверждения аккаунт не будет создан.
            </p>
            <Label htmlFor="emailCode" className="text-xs">Код из письма</Label>
            <Input
              id="emailCode"
              className="h-10 rounded-lg px-3"
              inputMode="numeric"
              placeholder="Введите 6-значный код"
              value={emailCode}
              onChange={(event) => setEmailCode(event.target.value)}
            />
          </div>
        ) : !twoFactorStep ? (
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

        {requiresLegalAcceptance && !twoFactorStep && !registrationVerificationStep ? (
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

        <Button className={`h-10 w-full rounded-lg ${registrationVerificationStep ? "hidden" : ""}`} onClick={submit} disabled={pending || (requiresLegalAcceptance && !legalAccepted)}>
          {pending ? "Подождите..." : type === "login" ? (twoFactorStep ? "Подтвердить вход" : "Войти") : "Создать аккаунт"}
        </Button>

        {registrationVerificationStep ? (
          <Button className="h-10 w-full rounded-lg" onClick={submit} disabled={pending || !emailCode.trim()}>
            {pending ? "Подождите..." : "Подтвердить email"}
          </Button>
        ) : null}

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

        {type === "register" && registrationVerificationStep ? (
          <Button
            variant="outline"
            className="h-10 w-full rounded-lg"
            onClick={() => {
              setRegistrationVerificationStep(false);
              setEmailCode("");
            }}
          >
            Назад
          </Button>
        ) : null}

        {!twoFactorStep && !registrationVerificationStep ? (
          <>
            <div className="grid gap-2.5">
              <button
                type="button"
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0077ff] px-3 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(0,119,255,0.18)] transition hover:bg-[#096de0] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => startVkAuth("/dashboard")}
                disabled={pending || (requiresLegalAcceptance && !legalAccepted)}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white text-[11px] font-black leading-none text-[#0077ff]">VK</span>
                Продолжить с VK ID
              </button>
              <TelegramLogin
                mode={type}
                enabled={telegramEnabled}
                clientId={telegramClientId}
                legalAccepted={externalAuthLegalAccepted}
                requireLegalAcceptance={requiresLegalAcceptance}
              />
            </div>

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
