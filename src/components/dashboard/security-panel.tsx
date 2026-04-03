"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Clock3,
  KeyRound,
  Laptop2,
  Mail,
  MapPin,
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type SecuritySessionItem = {
  id: string;
  device: string;
  platform: string;
  location: string;
  lastActive: string;
  current: boolean;
  icon: "laptop" | "phone";
};

type LoginHistoryItem = {
  id: string;
  status: "success" | "failed";
  device: string;
  location: string;
  ip: string;
  createdAt: string;
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
        className="flex w-full flex-col gap-3 p-5 text-left transition hover:bg-white/[0.02] sm:flex-row sm:items-start sm:justify-between sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white">
            {icon}
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="max-w-2xl text-sm leading-6 text-zinc-400">{description}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          {status ? <div className="sm:shrink-0">{status}</div> : <span />}
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white transition",
              isOpen && "rotate-180",
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
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
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className="rounded-[28px] border border-red-500/25 bg-[linear-gradient(180deg,rgba(85,18,25,0.24),rgba(22,10,12,0.92))] p-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-3 p-5 text-left transition hover:bg-white/[0.02] sm:flex-row sm:items-start sm:justify-between sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10 text-red-300">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">Danger Zone</h2>
            <p className="max-w-2xl text-sm leading-6 text-zinc-300/85">
              Удаление аккаунта необратимо. Все турниры, история и данные профиля будут потеряны.
            </p>
          </div>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10 text-red-200 transition",
            isOpen && "rotate-180",
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </div>
      </button>
      {isOpen ? (
        <div className="border-t border-red-500/20 px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-4 rounded-2xl border border-red-500/20 bg-black/20 p-4">
              <div className="space-y-2">
                <Label htmlFor="dangerConfirm">Введите УДАЛИТЬ для подтверждения</Label>
                <Input id="dangerConfirm" placeholder="УДАЛИТЬ" />
              </div>
              <div className="rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-100/85">
                После подтверждения аккаунт будет удалён без возможности восстановления.
              </div>
            </div>
            <div className="flex flex-col justify-end gap-2">
              <Button variant="outline">Отмена</Button>
              <Button className="bg-red-500 text-white hover:bg-red-400">
                <Trash2 className="mr-2 h-4 w-4" />
                Удалить аккаунт
              </Button>
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
  sessions,
  loginHistory,
}: {
  currentEmail: string;
  emailVerified: boolean;
  sessions: SecuritySessionItem[];
  loginHistory: LoginHistoryItem[];
}) {
  const router = useRouter();
  const [passwordPending, startPasswordTransition] = useTransition();
  const [emailPending, startEmailTransition] = useTransition();
  const [sessionsPending, startSessionsTransition] = useTransition();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  const [email, setEmail] = useState(currentEmail);
  const [verificationCode, setVerificationCode] = useState("");
  const [emailVerifiedState, setEmailVerifiedState] = useState(emailVerified);

  const [historyFilter, setHistoryFilter] = useState<"all" | "success" | "failed">("all");
  const [openSection, setOpenSection] = useState<string | null>("password");
  const [verificationPending, startVerificationTransition] = useTransition();

  const filteredHistory = useMemo(() => {
    if (historyFilter === "all") return loginHistory;
    return loginHistory.filter((item) => item.status === historyFilter);
  }, [historyFilter, loginHistory]);
  const hasBoundEmail = email.trim().length > 0;

  const changePassword = () => {
    startPasswordTransition(async () => {
      const res = await fetch("/api/security/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          repeatPassword,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(payload?.error || "Не удалось сменить пароль.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
      toast.success("Пароль обновлён.");
      router.refresh();
    });
  };

  const changeEmail = () => {
    startEmailTransition(async () => {
      const res = await fetch("/api/security/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
        }),
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
        body: JSON.stringify({
          code: verificationCode,
        }),
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

  const revokeSession = (authSessionId: string) => {
    startSessionsTransition(async () => {
      const res = await fetch("/api/security/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authSessionId,
        }),
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
        body: JSON.stringify({
          revokeAll: true,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(payload?.error || "Не удалось завершить сессии.");
        return;
      }

      toast.success("Все сессии завершены.");
      router.refresh();
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
        title="Смена пароля"
        description="Обновите пароль, чтобы защитить аккаунт и закрыть доступ со старых данных."
        status={<Badge variant="success">Защита включена</Badge>}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Текущий пароль</Label>
            <Input id="currentPassword" type="password" placeholder="Введите текущий пароль" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">Новый пароль</Label>
            <Input id="newPassword" type="password" placeholder="Новый пароль" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="repeatPassword">Повторите пароль</Label>
            <Input id="repeatPassword" type="password" placeholder="Повторите новый пароль" value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium text-white">Надёжность пароля</div>
            <div className="text-sm text-zinc-400">Используйте минимум 8 символов, цифры и заглавные буквы.</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/forgot-password">Забыли пароль?</Link>
            </Button>
            <Button disabled={passwordPending} onClick={changePassword}>
              {passwordPending ? "Сохраняем..." : "Сохранить новый пароль"}
            </Button>
          </div>
        </div>
      </SecuritySection>

      <SecuritySection
        sectionId="email"
        isOpen={openSection === "email"}
        onToggle={toggleSection}
        icon={<Mail className="h-5 w-5" />}
        title={hasBoundEmail ? "Email" : "Привязать почту"}
        description={
          hasBoundEmail
            ? "Почта используется для входа, подтверждений и восстановления доступа."
            : "Добавьте почту к аккаунту, если вошли через Telegram или VK."
        }
        status={
          <Badge variant={hasBoundEmail ? (emailVerifiedState ? "success" : "accent") : "neutral"}>
            {hasBoundEmail ? (emailVerifiedState ? "Подтверждён" : "Не подтверждён") : "Не привязана"}
          </Badge>
        }
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="email">{hasBoundEmail ? "Текущий email" : "Email для привязки"}</Label>
            <Input id="email" type="email" value={email} placeholder="Введите email" onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2 sm:w-52">
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
      </SecuritySection>

      <SecuritySection
        sectionId="2fa"
        isOpen={openSection === "2fa"}
        onToggle={toggleSection}
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Двухфакторная аутентификация (2FA)"
        description="Добавьте второй шаг подтверждения при входе в аккаунт."
        status={<Badge variant="neutral">Скоро будет</Badge>}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="space-y-1">
              <div className="text-sm font-medium text-white">Подключение 2FA</div>
              <div className="text-sm text-zinc-400">Отсканируйте QR-код в приложении Google Authenticator или Authy.</div>
            </div>
            <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] text-sm text-zinc-500">
              QR-код появится позже
            </div>
            <div className="space-y-2">
              <Label htmlFor="otpCode">Код подтверждения</Label>
              <Input id="otpCode" inputMode="numeric" placeholder="Введите 6-значный код" disabled />
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="space-y-1">
              <div className="text-sm font-medium text-white">Резервные коды</div>
              <div className="text-sm text-zinc-400">Сохраните их, чтобы восстановить доступ без телефона.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-4 font-mono text-sm tracking-[0.18em] text-zinc-300">
              XXXX-XXXX
              <br />
              XXXX-XXXX
              <br />
              XXXX-XXXX
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" disabled>
                Включить 2FA
              </Button>
              <Button variant="outline" className="flex-1" disabled>
                Скачать коды
              </Button>
            </div>
          </div>
        </div>
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

      <SecuritySection
        sectionId="history"
        isOpen={openSection === "history"}
        onToggle={toggleSection}
        icon={<Clock3 className="h-5 w-5" />}
        title="История входов"
        description="Последние попытки входа в аккаунт с устройствами, IP и геолокацией."
        status={<Badge variant="neutral">Последние 30 дней</Badge>}
      >
        <div className="flex flex-wrap gap-2">
          <Button variant={historyFilter === "all" ? "secondary" : "ghost"} size="sm" onClick={() => setHistoryFilter("all")}>
            Все
          </Button>
          <Button variant={historyFilter === "success" ? "secondary" : "ghost"} size="sm" onClick={() => setHistoryFilter("success")}>
            Успешные
          </Button>
          <Button variant={historyFilter === "failed" ? "secondary" : "ghost"} size="sm" onClick={() => setHistoryFilter("failed")}>
            Ошибки
          </Button>
        </div>
        <Separator />
        <div className="space-y-3">
          {filteredHistory.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium text-white">{item.device}</div>
                  <Badge variant={item.status === "success" ? "success" : "danger"}>
                    {item.status === "success" ? "Успешно" : "Ошибка"}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
                  <span>{item.location}</span>
                  <span>{item.ip}</span>
                </div>
              </div>
              <div className="text-sm text-zinc-500">{item.createdAt}</div>
            </div>
          ))}
        </div>
      </SecuritySection>

      <DangerSection isOpen={openSection === "danger"} onToggle={() => toggleSection("danger")} />
    </>
  );
}
