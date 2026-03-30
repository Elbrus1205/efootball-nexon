import Link from "next/link";
import {
  Clock3,
  KeyRound,
  Laptop2,
  Lock,
  Mail,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type SessionItem = {
  id: string;
  device: string;
  platform: string;
  location: string;
  lastActive: string;
  current?: boolean;
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

const activeSessions: SessionItem[] = [
  {
    id: "current",
    device: "Chrome на Windows",
    platform: "Текущее устройство",
    location: "Москва, Россия",
    lastActive: "Сейчас",
    current: true,
    icon: "laptop",
  },
  {
    id: "iphone",
    device: "Safari на iPhone",
    platform: "Мобильное устройство",
    location: "Москва, Россия",
    lastActive: "Сегодня, 12:42",
    icon: "phone",
  },
  {
    id: "telegram-web",
    device: "Telegram Web",
    platform: "Браузер",
    location: "Санкт-Петербург, Россия",
    lastActive: "Вчера, 22:18",
    icon: "laptop",
  },
];

const loginHistory: LoginHistoryItem[] = [
  {
    id: "1",
    status: "success",
    device: "Chrome на Windows",
    location: "Москва, Россия",
    ip: "95.24.xxx.xxx",
    createdAt: "Сегодня, 13:24",
  },
  {
    id: "2",
    status: "success",
    device: "Safari на iPhone",
    location: "Москва, Россия",
    ip: "95.24.xxx.xxx",
    createdAt: "Сегодня, 12:42",
  },
  {
    id: "3",
    status: "failed",
    device: "Неизвестный браузер",
    location: "Варшава, Польша",
    ip: "185.17.xxx.xxx",
    createdAt: "Вчера, 02:11",
  },
];

function statusBadgeVariant(status: LoginHistoryItem["status"]) {
  return status === "success" ? "success" : "danger";
}

function SessionIcon({ icon }: { icon: SessionItem["icon"] }) {
  return icon === "phone" ? <Smartphone className="h-5 w-5" /> : <Laptop2 className="h-5 w-5" />;
}

function SecuritySection({
  icon,
  title,
  description,
  status,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-[28px] border border-white/10 bg-[#11151d] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white">
              {icon}
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <p className="max-w-2xl text-sm leading-6 text-zinc-400">{description}</p>
            </div>
          </div>
          {status ? <div className="sm:shrink-0">{status}</div> : null}
        </div>
        {children}
      </div>
    </Card>
  );
}

export default async function DashboardSecurityPage() {
  const session = await requireAuth();

  return (
    <div className="page-shell py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-3">
          <Badge variant="primary">Безопасность</Badge>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-white">Безопасность аккаунта</h1>
              <p className="max-w-2xl text-sm text-zinc-400">
                Управление паролем, email, защитой входа и устройствами аккаунта.
              </p>
            </div>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/dashboard">Назад к профилю</Link>
            </Button>
          </div>
        </div>

        <SecuritySection
          icon={<KeyRound className="h-5 w-5" />}
          title="Смена пароля"
          description="Обновите пароль, чтобы защитить аккаунт и закрыть доступ со старых данных."
          status={<Badge variant="success">Защита включена</Badge>}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Текущий пароль</Label>
              <Input id="currentPassword" type="password" placeholder="Введите текущий пароль" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Новый пароль</Label>
              <Input id="newPassword" type="password" placeholder="Новый пароль" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repeatPassword">Повторите пароль</Label>
              <Input id="repeatPassword" type="password" placeholder="Повторите новый пароль" />
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
              <Button>Сохранить новый пароль</Button>
            </div>
          </div>
        </SecuritySection>

        <SecuritySection
          icon={<Mail className="h-5 w-5" />}
          title="Email"
          description="Почта используется для входа, подтверждений и восстановления доступа."
          status={<Badge variant="success">Подтверждён</Badge>}
        >
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="email">Текущий email</Label>
              <Input id="email" type="email" defaultValue={session.user.email ?? ""} />
            </div>
            <div className="flex flex-col gap-2 sm:w-52">
              <Button>Сохранить email</Button>
              <Button variant="outline">Отправить письмо ещё раз</Button>
            </div>
          </div>
        </SecuritySection>

        <SecuritySection
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Двухфакторная аутентификация (2FA)"
          description="Добавьте второй шаг подтверждения при входе в аккаунт."
          status={<Badge variant="neutral">Выключена</Badge>}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="space-y-1">
                <div className="text-sm font-medium text-white">Подключение 2FA</div>
                <div className="text-sm text-zinc-400">Отсканируйте QR-код в приложении Google Authenticator или Authy.</div>
              </div>
              <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] text-sm text-zinc-500">
                QR-код появится после подключения
              </div>
              <div className="space-y-2">
                <Label htmlFor="otpCode">Код подтверждения</Label>
                <Input id="otpCode" inputMode="numeric" placeholder="Введите 6-значный код" />
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
                <Button className="flex-1">Включить 2FA</Button>
                <Button variant="outline" className="flex-1">
                  Скачать коды
                </Button>
              </div>
            </div>
          </div>
        </SecuritySection>

        <SecuritySection
          icon={<Laptop2 className="h-5 w-5" />}
          title="Активные сессии"
          description="Посмотрите, с каких устройств сейчас открыт ваш аккаунт, и завершите лишние сессии."
          status={<Badge variant="primary">{activeSessions.length} устройства</Badge>}
        >
          <div className="space-y-3">
            {activeSessions.map((item) => (
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
                <Button variant={item.current ? "outline" : "secondary"} className="sm:w-auto">
                  {item.current ? "Это устройство" : "Завершить"}
                </Button>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="outline">Выйти на всех устройствах</Button>
          </div>
        </SecuritySection>

        <SecuritySection
          icon={<Clock3 className="h-5 w-5" />}
          title="История входов"
          description="Последние попытки входа в аккаунт с устройствами, IP и геолокацией."
          status={<Badge variant="neutral">Последние 30 дней</Badge>}
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm">
              Все
            </Button>
            <Button variant="ghost" size="sm">
              Успешные
            </Button>
            <Button variant="ghost" size="sm">
              Ошибки
            </Button>
          </div>
          <Separator />
          <div className="space-y-3">
            {loginHistory.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium text-white">{item.device}</div>
                    <Badge variant={statusBadgeVariant(item.status)}>
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

        <Card className="rounded-[28px] border border-red-500/25 bg-[linear-gradient(180deg,rgba(85,18,25,0.24),rgba(22,10,12,0.92))] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:gap-5">
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
        </Card>
      </div>
    </div>
  );
}
