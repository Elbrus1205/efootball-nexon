"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
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
import { startVkIdAuth } from "@/lib/vkid-client";

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
            <h2 className="text-[17px] font-semibold leading-7 text-white sm:text-lg">РЈРґР°Р»РµРЅРёРµ Р°РєРєР°СѓРЅС‚Р°</h2>
            <p className="max-w-2xl text-sm leading-7 text-zinc-300/85 sm:leading-6">
              РЈРґР°Р»РµРЅРёРµ Р°РєРєР°СѓРЅС‚Р° РЅРµРѕР±СЂР°С‚РёРјРѕ. Р’СЃРµ С‚СѓСЂРЅРёСЂС‹, РёСЃС‚РѕСЂРёСЏ Рё РґР°РЅРЅС‹Рµ РїСЂРѕС„РёР»СЏ Р±СѓРґСѓС‚ РїРѕС‚РµСЂСЏРЅС‹.
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
                <div className="text-sm font-semibold text-white">РџРѕРґС‚РІРµСЂРґРёС‚Рµ СѓРґР°Р»РµРЅРёРµ Р°РєРєР°СѓРЅС‚Р°</div>
                <div className="text-sm text-zinc-400">
                  Р”Р»СЏ СѓРґР°Р»РµРЅРёСЏ РЅСѓР¶РЅС‹ РїР°СЂРѕР»СЊ РѕС‚ Р°РєРєР°СѓРЅС‚Р°, РєРѕРґ СЃ РїРѕС‡С‚С‹ Рё РєРѕРґ РёР· Telegram. РџРѕСЃР»Рµ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ РїСЂРѕС„РёР»СЊ Р±СѓРґРµС‚ СѓРґР°Р»С‘РЅ РЅР°РІСЃРµРіРґР°.
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dangerPassword">РџР°СЂРѕР»СЊ РѕС‚ Р°РєРєР°СѓРЅС‚Р°</Label>
                  <Input
                    id="dangerPassword"
                    type="password"
                    placeholder="Р’РІРµРґРёС‚Рµ РїР°СЂРѕР»СЊ"
                    value={confirmPassword}
                    onChange={(event) => onPasswordChange(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dangerEmailCode">РљРѕРґ РёР· РїРёСЃСЊРјР°</Label>
                  <Input
                    id="dangerEmailCode"
                    inputMode="numeric"
                    placeholder="6-Р·РЅР°С‡РЅС‹Р№ РєРѕРґ"
                    value={emailCode}
                    onChange={(event) => onEmailCodeChange(event.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="dangerTelegramCode">РљРѕРґ РёР· Telegram</Label>
                  <Input
                    id="dangerTelegramCode"
                    inputMode="numeric"
                    placeholder="6-Р·РЅР°С‡РЅС‹Р№ РєРѕРґ РёР· Telegram"
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
                  {codePending ? "РћС‚РїСЂР°РІР»СЏРµРј РєРѕРґС‹..." : "РџРѕР»СѓС‡РёС‚СЊ РєРѕРґС‹"}
                </Button>
              </div>

              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-100/85">
                Р•СЃР»Рё СЌС‚Рѕ Р±С‹Р»Рё РЅРµ РІС‹, РїСЂРѕСЃС‚Рѕ Р·Р°РєСЂРѕР№С‚Рµ СЌС‚РѕС‚ СЂР°Р·РґРµР». РќРёРєРѕРјСѓ РЅРµ РїРµСЂРµРґР°РІР°Р№С‚Рµ РєРѕРґС‹ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ.
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
                {pending ? "РЈРґР°Р»СЏРµРј Р°РєРєР°СѓРЅС‚..." : "РЈРґР°Р»РёС‚СЊ Р°РєРєР°СѓРЅС‚"}
              </Button>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-100/85">
              РџРѕСЃР»Рµ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ Р°РєРєР°СѓРЅС‚ Р±СѓРґРµС‚ СѓРґР°Р»С‘РЅ Р±РµР· РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ.
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
    void (async () => {
      try {
        if (typeof window === "undefined") return;

        const host = window.location.hostname.toLowerCase();
        const protocol = window.location.protocol;
        const canonicalOrigin =
          host === "efootball-nexon.ru" ? `${protocol}//www.efootball-nexon.ru` : window.location.origin;

        await startVkIdAuth({
          mode: "bind",
          callbackUrl: `${canonicalOrigin}${callbackPath}`,
        });
      } catch {
        toast.error("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РїСѓСЃС‚РёС‚СЊ РїСЂРёРІСЏР·РєСѓ VK.");
      }
    })();
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
        toast.error(payload?.error || "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РїР°СЂРѕР»СЊ.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
      setPasswordCode("");
      toast.success("РџР°СЂРѕР»СЊ РѕР±РЅРѕРІР»С‘РЅ.");
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
        toast.error(payload?.error || "РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РєРѕРґ РґР»СЏ СЃРјРµРЅС‹ РїР°СЂРѕР»СЏ.");
        return;
      }

      toast.success("РљРѕРґ РґР»СЏ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ РїР°СЂРѕР»СЏ РѕС‚РїСЂР°РІР»РµРЅ РЅР° РїРѕС‡С‚Сѓ.");
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
          toast.error(payload?.error || "Email РѕР±РЅРѕРІР»С‘РЅ, РЅРѕ РєРѕРґ РЅРµ РѕС‚РїСЂР°РІРёР»СЃСЏ.");
          router.refresh();
          return;
        }

        toast.error(payload?.error || "РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ email.");
        return;
      }

      setEmail(payload?.email ?? email);
      setEmailVerifiedState(false);
      toast.success(payload?.verificationSent ? "Email РѕР±РЅРѕРІР»С‘РЅ. РљРѕРґ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ СѓР¶Рµ РѕС‚РїСЂР°РІР»РµРЅ." : "Email РѕР±РЅРѕРІР»С‘РЅ.");
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
        toast.error(payload?.error || "РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РєРѕРґ.");
        return;
      }

      toast.success("РљРѕРґ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ РѕС‚РїСЂР°РІР»РµРЅ РЅР° РїРѕС‡С‚Сѓ.");
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
        toast.error(payload?.error || "РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕРґС‚РІРµСЂРґРёС‚СЊ email.");
        return;
      }

      setVerificationCode("");
      setEmailVerifiedState(true);
      toast.success("Email РїРѕРґС‚РІРµСЂР¶РґС‘РЅ.");
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
        toast.error(payload?.error || "РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РєРѕРґ РІ Telegram.");
        return;
      }

      setTwoFactorChallengeToken(payload?.challengeToken ?? "");
      toast.success("РљРѕРґ РѕС‚РїСЂР°РІР»РµРЅ РІ Telegram-Р±РѕС‚.");
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
        toast.error(payload?.error || "РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕРґС‚РІРµСЂРґРёС‚СЊ РєРѕРґ 2FA.");
        return;
      }

      setTelegram2faEnabledState(Boolean(payload?.enabled));
      setTwoFactorCode("");
      setTwoFactorChallengeToken("");
      toast.success(payload?.enabled ? "2FA С‡РµСЂРµР· Telegram РІРєР»СЋС‡РµРЅР°." : "2FA С‡РµСЂРµР· Telegram РѕС‚РєР»СЋС‡РµРЅР°.");
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
        toast.error(payload?.error || "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РІРµСЂС€РёС‚СЊ СЃРµСЃСЃРёСЋ.");
        return;
      }

      toast.success("РЎРµСЃСЃРёСЏ Р·Р°РІРµСЂС€РµРЅР°.");
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
        toast.error(payload?.error || "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РІРµСЂС€РёС‚СЊ РІСЃРµ СЃРµСЃСЃРёРё.");
        return;
      }

      toast.success("Р’СЃРµ СЃРµСЃСЃРёРё Р·Р°РІРµСЂС€РµРЅС‹.");
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
        toast.error(payload?.error || "РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РєРѕРґС‹ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ.");
        return;
      }

      setDeleteTelegramChallengeToken(payload?.telegramChallengeToken ?? "");
      toast.success("РљРѕРґС‹ РѕС‚РїСЂР°РІР»РµРЅС‹ РЅР° РїРѕС‡С‚Сѓ Рё РІ Telegram.");
    });
  };

  const deleteAccount = () => {
    startAccountDeleteTransition(async () => {
      if (!deleteTelegramChallengeToken) {
        toast.error("РЎРЅР°С‡Р°Р»Р° РЅР°Р¶РјРёС‚Рµ В«РџРѕР»СѓС‡РёС‚СЊ РєРѕРґС‹В».");
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
        toast.error(payload?.error || "РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ Р°РєРєР°СѓРЅС‚.");
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
        title={hasPassword ? "РЎРјРµРЅР° РїР°СЂРѕР»СЏ" : "РЎРѕР·РґР°С‚СЊ РїР°СЂРѕР»СЊ"}
        description={
          hasPassword
            ? "РћР±РЅРѕРІРёС‚Рµ РїР°СЂРѕР»СЊ, С‡С‚РѕР±С‹ Р·Р°С‰РёС‚РёС‚СЊ Р°РєРєР°СѓРЅС‚ Рё Р·Р°РєСЂС‹С‚СЊ РґРѕСЃС‚СѓРї СЃРѕ СЃС‚Р°СЂС‹С… РґР°РЅРЅС‹С…."
            : "Р—Р°РґР°Р№С‚Рµ РїР°СЂРѕР»СЊ РґР»СЏ РІС…РѕРґР° РїРѕ РїРѕС‡С‚Рµ, РµСЃР»Рё Р°РєРєР°СѓРЅС‚ Р±С‹Р» СЃРѕР·РґР°РЅ С‡РµСЂРµР· Telegram РёР»Рё VK."
        }
        status={<Badge variant="success">Р—Р°С‰РёС‚Р° РІРєР»СЋС‡РµРЅР°</Badge>}
      >
        <div className={cn("grid gap-4", hasPassword ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          {hasPassword ? (
            <div className="space-y-2">
              <Label htmlFor="currentPassword">РўРµРєСѓС‰РёР№ РїР°СЂРѕР»СЊ</Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="Р’РІРµРґРёС‚Рµ С‚РµРєСѓС‰РёР№ РїР°СЂРѕР»СЊ"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="newPassword">РќРѕРІС‹Р№ РїР°СЂРѕР»СЊ</Label>
            <Input id="newPassword" type="password" placeholder="РќРѕРІС‹Р№ РїР°СЂРѕР»СЊ" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="repeatPassword">РџРѕРІС‚РѕСЂРёС‚Рµ РїР°СЂРѕР»СЊ</Label>
            <Input
              id="repeatPassword"
              type="password"
              placeholder="РџРѕРІС‚РѕСЂРёС‚Рµ РЅРѕРІС‹Р№ РїР°СЂРѕР»СЊ"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="passwordCode">РљРѕРґ СЃ РїРѕС‡С‚С‹</Label>
            <Input
              id="passwordCode"
              inputMode="numeric"
              placeholder="Р’РІРµРґРёС‚Рµ 6-Р·РЅР°С‡РЅС‹Р№ РєРѕРґ"
              value={passwordCode}
              onChange={(e) => setPasswordCode(e.target.value)}
            />
            <div className="text-sm text-zinc-400">
              РџРµСЂРµРґ СЃРѕС…СЂР°РЅРµРЅРёРµРј РѕС‚РїСЂР°РІСЊС‚Рµ РєРѕРґ РЅР° РїСЂРёРІСЏР·Р°РЅРЅСѓСЋ РїРѕС‡С‚Сѓ Рё РїРѕРґС‚РІРµСЂРґРёС‚Рµ РёРј СЃРѕР·РґР°РЅРёРµ РёР»Рё СЃРјРµРЅСѓ РїР°СЂРѕР»СЏ.
            </div>
          </div>
          <Button variant="outline" disabled={passwordCodePending || !hasBoundEmail} onClick={sendPasswordCode}>
            {passwordCodePending ? "РћС‚РїСЂР°РІР»СЏРµРј..." : "РћС‚РїСЂР°РІРёС‚СЊ РєРѕРґ"}
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium text-white">РќР°РґС‘Р¶РЅРѕСЃС‚СЊ РїР°СЂРѕР»СЏ</div>
            <div className="text-sm text-zinc-400">РСЃРїРѕР»СЊР·СѓР№С‚Рµ РјРёРЅРёРјСѓРј 8 СЃРёРјРІРѕР»РѕРІ, С†РёС„СЂС‹ Рё Р·Р°РіР»Р°РІРЅС‹Рµ Р±СѓРєРІС‹.</div>
          </div>
          <div className="flex gap-2">
            {hasPassword ? (
              <Button variant="outline" asChild>
                <Link href="/forgot-password">Р—Р°Р±С‹Р»Рё РїР°СЂРѕР»СЊ?</Link>
              </Button>
            ) : null}
            <Button disabled={passwordPending} onClick={changePassword}>
              {passwordPending ? "РЎРѕС…СЂР°РЅСЏРµРј..." : hasPassword ? "РЎРѕС…СЂР°РЅРёС‚СЊ РЅРѕРІС‹Р№ РїР°СЂРѕР»СЊ" : "РЎРѕР·РґР°С‚СЊ РїР°СЂРѕР»СЊ"}
            </Button>
          </div>
        </div>
      </SecuritySection>

      <SecuritySection
        sectionId="email"
        isOpen={openSection === "email"}
        onToggle={toggleSection}
        icon={<Mail className="h-5 w-5" />}
        title="РџСЂРёРІСЏР·РєРё Р°РєРєР°СѓРЅС‚Р°"
        description="РЈРїСЂР°РІР»СЏР№С‚Рµ РїРѕС‡С‚РѕР№, Telegram Рё VK РІ РѕРґРЅРѕРј РјРµСЃС‚Рµ. Telegram Рё VK РїРѕСЃР»Рµ РїСЂРёРІСЏР·РєРё РјРѕР¶РµС‚ РёР·РјРµРЅРёС‚СЊ С‚РѕР»СЊРєРѕ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ."
        status={
          <Badge variant={hasBoundEmail || telegramLinked || vkLinked ? "success" : "neutral"}>
            {[hasBoundEmail, telegramLinked, vkLinked].filter(Boolean).length}/3 РїРѕРґРєР»СЋС‡РµРЅРѕ
          </Badge>
        }
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[26px] border border-white/10 bg-black/20 p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white">Email</div>
                <div className="text-sm text-zinc-400">
                  РџРѕС‡С‚Р° РЅСѓР¶РЅР° РґР»СЏ РІС…РѕРґР°, РїРѕРґС‚РІРµСЂР¶РґРµРЅРёР№, СЃРјРµРЅС‹ РїР°СЂРѕР»СЏ Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ РґРѕСЃС‚СѓРїР°.
                </div>
              </div>
              <Badge variant={hasBoundEmail ? (emailVerifiedState ? "success" : "accent") : "neutral"}>
                {hasBoundEmail ? (emailVerifiedState ? "РџРѕРґС‚РІРµСЂР¶РґС‘РЅ" : "РќРµ РїРѕРґС‚РІРµСЂР¶РґС‘РЅ") : "РќРµ РїСЂРёРІСЏР·Р°РЅ"}
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{hasBoundEmail ? "РўРµРєСѓС‰РёР№ email" : "Email РґР»СЏ РїСЂРёРІСЏР·РєРё"}</Label>
                <Input id="email" type="email" value={email} placeholder="Р’РІРµРґРёС‚Рµ email" onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div className="flex flex-col gap-2">
                <Button disabled={emailPending || email.trim().length === 0} onClick={changeEmail}>
                  {emailPending ? "РЎРѕС…СЂР°РЅСЏРµРј..." : hasBoundEmail ? "РР·РјРµРЅРёС‚СЊ email" : "РџСЂРёРІСЏР·Р°С‚СЊ РїРѕС‡С‚Сѓ"}
                </Button>
                {!emailVerifiedState ? (
                  <Button variant="outline" disabled={verificationPending || email.trim().length === 0} onClick={sendVerificationCode}>
                    {verificationPending ? "РћС‚РїСЂР°РІР»СЏРµРј..." : "РћС‚РїСЂР°РІРёС‚СЊ РєРѕРґ"}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-black/20 p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white">Telegram</div>
                <div className="text-sm text-zinc-400">Вход через Telegram и коды 2FA в нашем боте.</div>
              </div>
              <Badge variant={telegramLinked ? "success" : "neutral"}>
                {telegramLinked ? "Подключён" : "Не подключён"}
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
                <div className="text-sm text-zinc-400">Быстрый вход и регистрация через VK ID.</div>
              </div>
              <Badge variant={vkLinked ? "success" : "neutral"}>
                {vkLinked ? "Подключён" : "Не подключён"}
              </Badge>
            </div>

            {vkLinked ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                VK уже подключён к вашему аккаунту.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
                  Войдите через VK, чтобы подключить его к текущему аккаунту.
                </div>
                <Button className="w-full" onClick={() => startVkAuth("/dashboard/security")}>
                  Подключить VK
                </Button>
              </div>
            )}
          </div>
        </div>

        {!emailVerifiedState ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="verificationCode">РљРѕРґ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ</Label>
                <Input
                  id="verificationCode"
                  inputMode="numeric"
                  placeholder="Р’РІРµРґРёС‚Рµ РєРѕРґ РёР· РїРёСЃСЊРјР°"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                />
              </div>
              <Button disabled={verificationPending || verificationCode.trim().length < 6} onClick={verifyEmailCode}>
                {verificationPending ? "РџСЂРѕРІРµСЂСЏРµРј..." : "РџРѕРґС‚РІРµСЂРґРёС‚СЊ email"}
              </Button>
            </div>
            <div className="mt-3 text-sm text-zinc-400">
              РџРѕСЃР»Рµ РїСЂРёРІСЏР·РєРё РёР»Рё СЃРјРµРЅС‹ РїРѕС‡С‚С‹ РЅР° СЌС‚РѕС‚ Р°РґСЂРµСЃ РїСЂРёРґС‘С‚ РїРёСЃСЊРјРѕ СЃ 6-Р·РЅР°С‡РЅС‹Рј РєРѕРґРѕРј.
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
          Telegram и VK можно подключить один раз. Для смены привязки обратитесь к администратору.
        </div>
      </SecuritySection>

      <SecuritySection
        sectionId="2fa"
        isOpen={openSection === "2fa"}
        onToggle={toggleSection}
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Р”РІСѓС…С„Р°РєС‚РѕСЂРЅР°СЏ Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёСЏ (2FA)"
        description="РџРѕСЃР»Рµ РІРІРѕРґР° Р»РѕРіРёРЅР° Рё РїР°СЂРѕР»СЏ СЃР°Р№С‚ РїРѕРїСЂРѕСЃРёС‚ РєРѕРґ, РєРѕС‚РѕСЂС‹Р№ РјС‹ РѕС‚РїСЂР°РІРёРј РІ РІР°С€РµРіРѕ Telegram-Р±РѕС‚Р°."
        status={<Badge variant={telegram2faEnabledState ? "success" : "neutral"}>{telegram2faEnabledState ? "Р’РєР»СЋС‡РµРЅР°" : "Р’С‹РєР»СЋС‡РµРЅР°"}</Badge>}
      >
        {!telegramLinked ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
            РЎРЅР°С‡Р°Р»Р° РїСЂРёРІСЏР¶РёС‚Рµ Telegram Рє Р°РєРєР°СѓРЅС‚Сѓ С‡РµСЂРµР· РІС…РѕРґ Telegram. РџРѕСЃР»Рµ СЌС‚РѕРіРѕ Р·РґРµСЃСЊ РјРѕР¶РЅРѕ Р±СѓРґРµС‚ РІРєР»СЋС‡РёС‚СЊ 2FA С‡РµСЂРµР· РЅР°С€РµРіРѕ Р±РѕС‚Р°.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="space-y-1">
                <div className="text-sm font-medium text-white">РљРѕРґ С‡РµСЂРµР· Telegram-Р±РѕС‚Р°</div>
                <div className="text-sm text-zinc-400">
                  РљРѕРґ Р±СѓРґРµС‚ РѕС‚РїСЂР°РІР»СЏС‚СЊСЃСЏ РІ Telegram {telegramHandle ? `(@${telegramHandle})` : ""}. РџРѕСЃР»Рµ РІС…РѕРґР° РЅР° СЃР°Р№С‚Рµ РїРѕСЏРІРёС‚СЃСЏ РІС‚РѕСЂРѕР№ С€Р°Рі СЃ РІРІРѕРґРѕРј СЌС‚РѕРіРѕ РєРѕРґР°.
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
                {telegram2faEnabledState
                  ? "2FA СѓР¶Рµ РІРєР»СЋС‡РµРЅР°. Р”Р»СЏ РѕС‚РєР»СЋС‡РµРЅРёСЏ С‚РѕР¶Рµ РїРѕС‚СЂРµР±СѓРµС‚СЃСЏ РєРѕРґ РёР· Telegram."
                  : "Р’РєР»СЋС‡РёС‚Рµ 2FA, Рё РїРѕСЃР»Рµ РЅР°Р¶Р°С‚РёСЏ РєРЅРѕРїРєРё В«Р’РѕР№С‚РёВ» СЃР°Р№С‚ Р±СѓРґРµС‚ РїСЂРѕСЃРёС‚СЊ РєРѕРґ РёР· Telegram-Р±РѕС‚Р°."}
              </div>
              <Button className="sm:w-auto" disabled={twoFactorPending} onClick={sendTwoFactorCode}>
                {twoFactorPending ? "РћС‚РїСЂР°РІР»СЏРµРј..." : telegram2faEnabledState ? "РћС‚РїСЂР°РІРёС‚СЊ РєРѕРґ РЅР° РѕС‚РєР»СЋС‡РµРЅРёРµ" : "РћС‚РїСЂР°РІРёС‚СЊ РєРѕРґ РЅР° РІРєР»СЋС‡РµРЅРёРµ"}
              </Button>
            </div>

            <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="space-y-1">
                <div className="text-sm font-medium text-white">РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ</div>
                <div className="text-sm text-zinc-400">Р’РІРµРґРёС‚Рµ РєРѕРґ, РєРѕС‚РѕСЂС‹Р№ Р±РѕС‚ РїСЂРёСЃР»Р°Р» РІР°Рј РІ Telegram.</div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="twoFactorCode">РљРѕРґ 2FA</Label>
                <Input
                  id="twoFactorCode"
                  inputMode="numeric"
                  placeholder="Р’РІРµРґРёС‚Рµ 6-Р·РЅР°С‡РЅС‹Р№ РєРѕРґ"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={twoFactorPending || twoFactorCode.trim().length < 6 || !twoFactorChallengeToken}
                onClick={verifyTwoFactorCode}
              >
                {twoFactorPending ? "РџСЂРѕРІРµСЂСЏРµРј..." : telegram2faEnabledState ? "РћС‚РєР»СЋС‡РёС‚СЊ 2FA" : "Р’РєР»СЋС‡РёС‚СЊ 2FA"}
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
        title="РђРєС‚РёРІРЅС‹Рµ СЃРµСЃСЃРёРё"
        description="РџРѕСЃРјРѕС‚СЂРёС‚Рµ, СЃ РєР°РєРёС… СѓСЃС‚СЂРѕР№СЃС‚РІ СЃРµР№С‡Р°СЃ РѕС‚РєСЂС‹С‚ РІР°С€ Р°РєРєР°СѓРЅС‚, Рё Р·Р°РІРµСЂС€РёС‚Рµ Р»РёС€РЅРёРµ СЃРµСЃСЃРёРё."
        status={<Badge variant="primary">{sessions.length} СѓСЃС‚СЂРѕР№СЃС‚РІР°</Badge>}
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
                    {item.current ? <Badge variant="success">РўРµРєСѓС‰РµРµ СѓСЃС‚СЂРѕР№СЃС‚РІРѕ</Badge> : null}
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
                {item.current ? "Р­С‚Рѕ СѓСЃС‚СЂРѕР№СЃС‚РІРѕ" : "Р—Р°РІРµСЂС€РёС‚СЊ"}
              </Button>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" disabled={sessionsPending || sessions.length === 0} onClick={revokeAllSessions}>
            {sessionsPending ? "Р—Р°РІРµСЂС€Р°РµРј..." : "Р’С‹Р№С‚Рё РЅР° РІСЃРµС… СѓСЃС‚СЂРѕР№СЃС‚РІР°С…"}
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


