"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import {
  Clock3,
  KeyRound,
  Laptop2,
  Mail,
  MapPin,
  Minus,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TelegramConnect } from "@/components/dashboard/telegram-connect";
import { cn } from "@/lib/utils";

type SecuritySessionItem = {
  id: string;
  device: string;
  platform: string;
  location: string;
  ipAddress: string;
  lastActive: string;
  current: boolean;
  icon: "laptop" | "phone";
};

function SessionIcon({ icon }: { icon: SecuritySessionItem["icon"] }) {
  return icon === "phone" ? <Smartphone className="h-5 w-5" /> : <Laptop2 className="h-5 w-5" />;
}

function SecuritySection({
  sectionId,
  isOpen,
  onToggle,
  icon,
  title,
  description,
  status,
  children,
}: {
  sectionId: string;
  isOpen: boolean;
  onToggle: (sectionId: string) => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-[28px] border border-white/10 bg-[#11151d] p-0">
      <button
        type="button"
        onClick={() => onToggle(sectionId)}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4 text-left transition hover:bg-white/[0.02] sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] text-white sm:h-11 sm:w-11 sm:rounded-2xl">
            {icon}
          </div>
          <div className="min-w-0 space-y-1">
            <h2 className="text-[17px] font-semibold leading-7 text-white sm:text-lg">{title}</h2>
            <p className="max-w-2xl text-sm leading-7 text-zinc-400 sm:leading-6">{description}</p>
          </div>
        </div>
        <div className="flex items-start justify-end gap-3">
          <div className="hidden sm:block sm:shrink-0">{status}</div>
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-white transition-all duration-200",
              isOpen
                ? "border-blue-400/40 bg-blue-500/15 shadow-[0_0_0_4px_rgba(59,130,246,0.08)]"
                : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]",
            )}
          >
            {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </div>
        </div>
        <div className="col-span-2 flex pt-1 sm:hidden">{status ? status : <span />}</div>
      </button>
      {isOpen ? (
        <div className="border-t border-white/10 px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <div className="flex flex-col gap-4 sm:gap-5">{children}</div>
        </div>
      ) : null}
    </Card>
  );
}

function DangerSection({
  isOpen,
  onToggle,
  hasPassword,
  hasBoundEmail,
  telegramLinked,
  confirmPassword,
  emailCode,
  telegramCode,
  pending,
  codePending,
  onPasswordChange,
  onEmailCodeChange,
  onTelegramCodeChange,
  onSendCodes,
  onDelete,
}: {
  isOpen: boolean;
  onToggle: () => void;
  hasPassword: boolean;
  hasBoundEmail: boolean;
  telegramLinked: boolean;
  confirmPassword: string;
  emailCode: string;
  telegramCode: string;
  pending: boolean;
  codePending: boolean;
  onPasswordChange: (value: string) => void;
  onEmailCodeChange: (value: string) => void;
  onTelegramCodeChange: (value: string) => void;
  onSendCodes: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="rounded-[28px] border border-red-500/25 bg-[linear-gradient(180deg,rgba(85,18,25,0.24),rgba(22,10,12,0.92))] p-0">
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4 text-left transition hover:bg-white/[0.02] sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] border border-red-500/25 bg-red-500/10 text-red-300 sm:h-11 sm:w-11 sm:rounded-2xl">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <h2 className="text-[17px] font-semibold leading-7 text-white sm:text-lg">Удаление аккаунта</h2>
            <p className="max-w-2xl text-sm leading-7 text-zinc-300/85 sm:leading-6">
              Удаление аккаунта необратимо. Все турниры, история и данные профиля будут потеряны.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full border text-red-100 transition-all duration-200",
              isOpen
                ? "border-red-400/35 bg-red-500/14 shadow-[0_0_0_4px_rgba(239,68,68,0.08)]"
                : "border-red-500/25 bg-red-500/10 hover:bg-red-500/15",
            )}
          >
            {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </div>
        </div>
      </button>
      {isOpen ? (
        <div className="border-t border-red-500/20 px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <div className="space-y-4">
            <div className="rounded-2xl border border-red-500/20 bg-black/20 p-4 sm:p-5">
              <div className="mb-4 space-y-1">
                <div className="text-sm font-semibold text-white">Подтвердите удаление аккаунта</div>
                <div className="text-sm text-zinc-400">
                  Для удаления нужны пароль от аккаунта, код с почты и код из Telegram. После подтверждения профиль будет удалён навсегда.
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dangerPassword">Пароль от аккаунта</Label>
                  <Input
                    id="dangerPassword"
                    type="password"
                    placeholder="Введите пароль"
                    value={confirmPassword}
                    onChange={(event) => onPasswordChange(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dangerEmailCode">Код из письма</Label>
                  <Input
                    id="dangerEmailCode"
                    inputMode="numeric"
                    placeholder="6-значный код"
                    value={emailCode}
                    onChange={(event) => onEmailCodeChange(event.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="dangerTelegramCode">Код из Telegram</Label>
                  <Input
                    id="dangerTelegramCode"
                    inputMode="numeric"
                    placeholder="6-значный код из Telegram"
                    value={telegramCode}
                    onChange={(event) => onTelegramCodeChange(event.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                  disabled={codePending || !hasPassword || !hasBoundEmail || !telegramLinked}
                  onClick={onSendCodes}
                >
                  {codePending ? "Отправляем коды..." : "Получить коды"}
                </Button>
              </div>

              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-100/85">
                Если это были не вы, просто закройте этот раздел. Никому не передавайте коды подтверждения.
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                className="bg-red-500 text-white hover:bg-red-400"
                disabled={
                  pending ||
                  !hasPassword ||
                  !hasBoundEmail ||
                  !telegramLinked ||
                  confirmPassword.trim().length === 0 ||
                  emailCode.trim().length < 6 ||
                  telegramCode.trim().length < 6
                }
                onClick={onDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {pending ? "Удаляем аккаунт..." : "Удалить аккаунт"}
              </Button>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-100/85">
              После подтверждения аккаунт будет удалён без возможности восстановления.
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export function SecurityPanel({
  currentEmail,
  emailVerified,
  hasPassword,
  telegramLinked,
  telegramHandle,
  telegram2faEnabled,
  vkLinked,
  sessions,
}: {
  currentEmail: string;
  emailVerified: boolean;
  hasPassword: boolean;
  telegramLinked: boolean;
  telegramHandle: string | null;
  telegram2faEnabled: boolean;
  vkLinked: boolean;
  sessions: SecuritySessionItem[];
}) {
  const router = useRouter();
  const [passwordPending, startPasswordTransition] = useTransition();
  const [emailPending, startEmailTransition] = useTransition();
  const [sessionsPending, startSessionsTransition] = useTransition();
  const [verificationPending, startVerificationTransition] = useTransition();
  const [passwordCodePending, startPasswordCodeTransition] = useTransition();
  const [twoFactorPending, startTwoFactorTransition] = useTransition();
  const [accountDeletePending, startAccountDeleteTransition] = useTransition();
  const [accountDeleteCodePending, startAccountDeleteCodeTransition] = useTransition();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [passwordCode, setPasswordCode] = useState("");

  const [email, setEmail] = useState(currentEmail);
  const [verificationCode, setVerificationCode] = useState("");
  const [emailVerifiedState, setEmailVerifiedState] = useState(emailVerified);

  const [telegram2faEnabledState, setTelegram2faEnabledState] = useState(telegram2faEnabled);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorChallengeToken, setTwoFactorChallengeToken] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteEmailCode, setDeleteEmailCode] = useState("");
  const [deleteTelegramCode, setDeleteTelegramCode] = useState("");
  const [deleteTelegramChallengeToken, setDeleteTelegramChallengeToken] = useState("");

  const [openSection, setOpenSection] = useState<string | null>("password");

  const hasBoundEmail = email.trim().length > 0;

  const startVkAuth = (callbackPath: string) => {
    if (typeof window === "undefined") return;

    const host = window.location.hostname.toLowerCase();
    const protocol = window.location.protocol;
    const canonicalOrigin =
      host === "efootball-nexon.ru" ? `${protocol}//www.efootball-nexon.ru` : window.location.origin;
    const callbackUrl = `${canonicalOrigin}${callbackPath}`;
    void signIn("vk", { callbackUrl });
  };

  const changePassword = () => {
    startPasswordTransition(async () => {
      const res = await fetch("/api/security/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          repeatPassword,
          code: passwordCode,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(payload?.error || "Не удалось сохранить пароль.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
      setPasswordCode("");
      toast.success("Пароль обновлён.");
      router.refresh();
    });
  };

  const sendPasswordCode = () => {
    startPasswordCodeTransition(async () => {
      const res = await fetch("/api/security/password/send-code", {
        method: "POST",
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(payload?.error || "Не удалось отправить код для смены пароля.");
        return;
      }

      toast.success("Код для подтверждения пароля отправлен на почту.");
    });
  };

  const changeEmail = () => {
    startEmailTransition(async () => {
      const res = await fetch("/api/security/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        if (payload?.emailUpdated) {
          setEmail(payload.email ?? email);
          setEmailVerifiedState(false);
          toast.error(payload?.error || "Email обновлён, но код не отправился.");
          router.refresh();
          return;
        }

        toast.error(payload?.error || "Не удалось обновить email.");
        return;
      }

      setEmail(payload?.email ?? email);
      setEmailVerifiedState(false);
      toast.success(payload?.verificationSent ? "Email обновлён. Код подтверждения уже отправлен." : "Email обновлён.");
      router.refresh();
    });
  };

  const sendVerificationCode = () => {
    startVerificationTransition(async () => {
      const res = await fetch("/api/security/email/send-code", {
        method: "POST",
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(payload?.error || "Не удалось отправить код.");
        return;
      }

      toast.success("Код подтверждения отправлен на почту.");
    });
  };

  const verifyEmailCode = () => {
    startVerificationTransition(async () => {
      const res = await fetch("/api/security/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verificationCode }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(payload?.error || "Не удалось подтвердить email.");
        return;
      }

      setVerificationCode("");
      setEmailVerifiedState(true);
      toast.success("Email подтверждён.");
      router.refresh();
    });
  };

  const sendTwoFactorCode = () => {
    startTwoFactorTransition(async () => {
      const res = await fetch("/api/security/2fa/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(payload?.error || "Не удалось отправить код в Telegram.");
        return;
      }

      setTwoFactorChallengeToken(payload?.challengeToken ?? "");
      toast.success("Код отправлен в Telegram-бот.");
    });
  };

  const verifyTwoFactorCode = () => {
    startTwoFactorTransition(async () => {
      const res = await fetch("/api/security/2fa/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          challengeToken: twoFactorChallengeToken,
          code: twoFactorCode,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(payload?.error || "Не удалось подтвердить код 2FA.");
        return;
      }

      setTelegram2faEnabledState(Boolean(payload?.enabled));
      setTwoFactorCode("");
      setTwoFactorChallengeToken("");
      toast.success(payload?.enabled ? "2FA через Telegram включена." : "2FA через Telegram отключена.");
      router.refresh();
    });
  };

  const revokeSession = (authSessionId: string) => {
    startSessionsTransition(async () => {
      const res = await fetch("/api/security/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authSessionId }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(payload?.error || "Не удалось завершить сессию.");
        return;
      }

      toast.success("Сессия завершена.");
      router.refresh();
    });
  };

  const revokeAllSessions = () => {
    startSessionsTransition(async () => {
      const res = await fetch("/api/security/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revokeAll: true }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(payload?.error || "Не удалось завершить все сессии.");
        return;
      }

      toast.success("Все сессии завершены.");
      router.refresh();
    });
  };

  const sendAccountDeletionCodes = () => {
    startAccountDeleteCodeTransition(async () => {
      const res = await fetch("/api/security/account/send-code", {
        method: "POST",
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(payload?.error || "Не удалось отправить коды подтверждения.");
        return;
      }

      setDeleteTelegramChallengeToken(payload?.telegramChallengeToken ?? "");
      toast.success("Коды отправлены на почту и в Telegram.");
    });
  };

  const deleteAccount = () => {
    startAccountDeleteTransition(async () => {
      if (!deleteTelegramChallengeToken) {
        toast.error("Сначала нажмите «Получить коды».");
        return;
      }

      const res = await fetch("/api/security/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: deletePassword,
          emailCode: deleteEmailCode,
          telegramCode: deleteTelegramCode,
          telegramChallengeToken: deleteTelegramChallengeToken,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(payload?.error || "Не удалось удалить аккаунт.");
        return;
      }

      await signOut({
        redirect: true,
        callbackUrl: "/",
      });
    });
  };

  const toggleSection = (sectionId: string) => {
    setOpenSection((current) => (current === sectionId ? null : sectionId));
  };

  return (
    <>
      <SecuritySection
        sectionId="password"
        isOpen={openSection === "password"}
        onToggle={toggleSection}
        icon={<KeyRound className="h-5 w-5" />}
        title={hasPassword ? "Смена пароля" : "Создать пароль"}
        description={
          hasPassword
            ? "Обновите пароль, чтобы защитить аккаунт и закрыть доступ со старых данных."
            : "Задайте пароль для входа по почте, если аккаунт был создан через Telegram или VK."
        }
        status={<Badge variant="success">Защита включена</Badge>}
      >
        <div className={cn("grid gap-4", hasPassword ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          {hasPassword ? (
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Текущий пароль</Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="Введите текущий пароль"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="newPassword">Новый пароль</Label>
            <Input id="newPassword" type="password" placeholder="Новый пароль" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="repeatPassword">Повторите пароль</Label>
            <Input
              id="repeatPassword"
              type="password"
              placeholder="Повторите новый пароль"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="passwordCode">Код с почты</Label>
            <Input
              id="passwordCode"
              inputMode="numeric"
              placeholder="Введите 6-значный код"
              value={passwordCode}
              onChange={(e) => setPasswordCode(e.target.value)}
            />
            <div className="text-sm text-zinc-400">
              Перед сохранением отправьте код на привязанную почту и подтвердите им создание или смену пароля.
            </div>
          </div>
          <Button variant="outline" disabled={passwordCodePending || !hasBoundEmail} onClick={sendPasswordCode}>
            {passwordCodePending ? "Отправляем..." : "Отправить код"}
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium text-white">Надёжность пароля</div>
            <div className="text-sm text-zinc-400">Используйте минимум 8 символов, цифры и заглавные буквы.</div>
          </div>
          <div className="flex gap-2">
            {hasPassword ? (
              <Button variant="outline" asChild>
                <Link href="/forgot-password">Забыли пароль?</Link>
              </Button>
            ) : null}
            <Button disabled={passwordPending} onClick={changePassword}>
              {passwordPending ? "Сохраняем..." : hasPassword ? "Сохранить новый пароль" : "Создать пароль"}
            </Button>
          </div>
        </div>
      </SecuritySection>

      <SecuritySection
        sectionId="email"
        isOpen={openSection === "email"}
        onToggle={toggleSection}
        icon={<Mail className="h-5 w-5" />}
        title="Привязки аккаунта"
        description="Управляйте почтой, Telegram и VK в одном месте. Telegram и VK после привязки может изменить только администратор."
        status={
          <Badge variant={hasBoundEmail || telegramLinked || vkLinked ? "success" : "neutral"}>
            {[hasBoundEmail, telegramLinked, vkLinked].filter(Boolean).length}/3 подключено
          </Badge>
        }
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[26px] border border-white/10 bg-black/20 p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white">Email</div>
                <div className="text-sm text-zinc-400">
                  Почта нужна для входа, подтверждений, смены пароля и восстановления доступа.
                </div>
              </div>
              <Badge variant={hasBoundEmail ? (emailVerifiedState ? "success" : "accent") : "neutral"}>
                {hasBoundEmail ? (emailVerifiedState ? "Подтверждён" : "Не подтверждён") : "Не привязан"}
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{hasBoundEmail ? "Текущий email" : "Email для привязки"}</Label>
                <Input id="email" type="email" value={email} placeholder="Введите email" onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div className="flex flex-col gap-2">
                <Button disabled={emailPending || email.trim().length === 0} onClick={changeEmail}>
                  {emailPending ? "Сохраняем..." : hasBoundEmail ? "Изменить email" : "Привязать почту"}
                </Button>
                {!emailVerifiedState ? (
                  <Button variant="outline" disabled={verificationPending || email.trim().length === 0} onClick={sendVerificationCode}>
                    {verificationPending ? "Отправляем..." : "Отправить код"}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-black/20 p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white">Telegram</div>
                <div className="text-sm text-zinc-400">
                  Используется для входа через Telegram и для кодов 2FA в нашего бота.
                </div>
              </div>
              <Badge variant={telegramLinked ? "success" : "neutral"}>
                {telegramLinked ? "Привязан" : "Не привязан"}
              </Badge>
            </div>

            <TelegramConnect
              botUsername={process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}
              linked={telegramLinked}
              telegramHandle={telegramHandle}
            />
          </div>

          <div className="rounded-[26px] border border-white/10 bg-black/20 p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white">VK</div>
                <div className="text-sm text-zinc-400">
                  VK можно привязать один раз. Смену или перенос привязки делает только администратор.
                </div>
              </div>
              <Badge variant={vkLinked ? "success" : "neutral"}>
                {vkLinked ? "Привязан" : "Не привязан"}
              </Badge>
            </div>

            {vkLinked ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  VK уже привязан к вашему аккаунту.
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
                  Изменить привязку VK без участия администратора нельзя.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
                  Нажмите кнопку ниже и войдите во VK, чтобы привязать текущий аккаунт.
                </div>
                <Button className="w-full" onClick={() => startVkAuth("/dashboard/security")}>
                  Привязать VK
                </Button>
              </div>
            )}
          </div>
        </div>

        {!emailVerifiedState ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="verificationCode">Код подтверждения</Label>
                <Input
                  id="verificationCode"
                  inputMode="numeric"
                  placeholder="Введите код из письма"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                />
              </div>
              <Button disabled={verificationPending || verificationCode.trim().length < 6} onClick={verifyEmailCode}>
                {verificationPending ? "Проверяем..." : "Подтвердить email"}
              </Button>
            </div>
            <div className="mt-3 text-sm text-zinc-400">
              После привязки или смены почты на этот адрес придёт письмо с 6-значным кодом.
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
          Если Telegram или VK уже подключены, поменять эту привязку самостоятельно нельзя. Для переноса обратитесь к администратору платформы.
        </div>
      </SecuritySection>

      <SecuritySection
        sectionId="2fa"
        isOpen={openSection === "2fa"}
        onToggle={toggleSection}
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Двухфакторная аутентификация (2FA)"
        description="После ввода логина и пароля сайт попросит код, который мы отправим в вашего Telegram-бота."
        status={<Badge variant={telegram2faEnabledState ? "success" : "neutral"}>{telegram2faEnabledState ? "Включена" : "Выключена"}</Badge>}
      >
        {!telegramLinked ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
            Сначала привяжите Telegram к аккаунту через вход Telegram. После этого здесь можно будет включить 2FA через нашего бота.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="space-y-1">
                <div className="text-sm font-medium text-white">Код через Telegram-бота</div>
                <div className="text-sm text-zinc-400">
                  Код будет отправляться в Telegram {telegramHandle ? `(@${telegramHandle})` : ""}. После входа на сайте появится второй шаг с вводом этого кода.
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
                {telegram2faEnabledState
                  ? "2FA уже включена. Для отключения тоже потребуется код из Telegram."
                  : "Включите 2FA, и после нажатия кнопки «Войти» сайт будет просить код из Telegram-бота."}
              </div>
              <Button className="sm:w-auto" disabled={twoFactorPending} onClick={sendTwoFactorCode}>
                {twoFactorPending ? "Отправляем..." : telegram2faEnabledState ? "Отправить код на отключение" : "Отправить код на включение"}
              </Button>
            </div>

            <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="space-y-1">
                <div className="text-sm font-medium text-white">Подтверждение</div>
                <div className="text-sm text-zinc-400">Введите код, который бот прислал вам в Telegram.</div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="twoFactorCode">Код 2FA</Label>
                <Input
                  id="twoFactorCode"
                  inputMode="numeric"
                  placeholder="Введите 6-значный код"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={twoFactorPending || twoFactorCode.trim().length < 6 || !twoFactorChallengeToken}
                onClick={verifyTwoFactorCode}
              >
                {twoFactorPending ? "Проверяем..." : telegram2faEnabledState ? "Отключить 2FA" : "Включить 2FA"}
              </Button>
            </div>
          </div>
        )}
      </SecuritySection>

      <SecuritySection
        sectionId="sessions"
        isOpen={openSection === "sessions"}
        onToggle={toggleSection}
        icon={<Laptop2 className="h-5 w-5" />}
        title="Активные сессии"
        description="Посмотрите, с каких устройств сейчас открыт ваш аккаунт, и завершите лишние сессии."
        status={<Badge variant="primary">{sessions.length} устройства</Badge>}
      >
        <div className="space-y-3">
          {sessions.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white">
                  <SessionIcon icon={item.icon} />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium text-white">{item.device}</div>
                    {item.current ? <Badge variant="success">Текущее устройство</Badge> : null}
                  </div>
                  <div className="text-sm text-zinc-400">{item.platform}</div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {item.location}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {item.lastActive}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    <span className="font-medium text-zinc-400">IP:</span>{" "}
                    {item.ipAddress}
                  </div>
                </div>
              </div>
              <Button variant={item.current ? "outline" : "secondary"} className="sm:w-auto" disabled={sessionsPending || item.current} onClick={() => revokeSession(item.id)}>
                {item.current ? "Это устройство" : "Завершить"}
              </Button>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" disabled={sessionsPending || sessions.length === 0} onClick={revokeAllSessions}>
            {sessionsPending ? "Завершаем..." : "Выйти на всех устройствах"}
          </Button>
        </div>
      </SecuritySection>
      <DangerSection
        isOpen={openSection === "danger"}
        onToggle={() => toggleSection("danger")}
        hasPassword={hasPassword}
        hasBoundEmail={hasBoundEmail}
        telegramLinked={telegramLinked}
        confirmPassword={deletePassword}
        emailCode={deleteEmailCode}
        telegramCode={deleteTelegramCode}
        pending={accountDeletePending}
        codePending={accountDeleteCodePending}
        onPasswordChange={setDeletePassword}
        onEmailCodeChange={setDeleteEmailCode}
        onTelegramCodeChange={setDeleteTelegramCode}
        onSendCodes={sendAccountDeletionCodes}
        onDelete={deleteAccount}
      />
    </>
  );
}


