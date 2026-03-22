"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TelegramLogin } from "@/components/auth/telegram-login";

export function AuthForm({ type }: { type: "login" | "register" }) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const router = useRouter();

  const submit = () => {
    startTransition(async () => {
      if (type === "register") {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });

        if (!res.ok) {
          toast.error("Не удалось создать аккаунт");
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Неверный email или пароль");
        return;
      }

      toast.success(type === "register" ? "Аккаунт создан" : "Вход выполнен");
      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>{type === "login" ? "Вход в eFootball Nexon" : "Регистрация игрока"}</CardTitle>
        <CardDescription>
          {type === "login"
            ? "Войдите через email, VK или Telegram."
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
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Пароль</Label>
          <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Подождите..." : type === "login" ? "Войти" : "Создать аккаунт"}
        </Button>

        <div className="grid gap-3">
          <Button variant="secondary" className="w-full" onClick={() => signIn("vk", { callbackUrl: "/dashboard" })}>
            Продолжить через VK
          </Button>
          <TelegramLogin botUsername={process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME} />
        </div>

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
      </CardContent>
    </Card>
  );
}
