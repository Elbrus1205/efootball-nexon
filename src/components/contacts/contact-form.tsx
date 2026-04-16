"use client";

import { FormEvent, useState } from "react";
import { Copy, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ContactFormProps = {
  supportEmail: string;
};

const topics = ["Спор по матчу", "Регистрация", "Турнир", "Аккаунт", "Другое"];

export function ContactForm({ supportEmail }: ContactFormProps) {
  const [topic, setTopic] = useState(topics[0]);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [matchLink, setMatchLink] = useState("");
  const [message, setMessage] = useState("");

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(supportEmail);
      toast.success("Email скопирован.");
    } catch {
      toast.error("Не удалось скопировать email.");
    }
  };

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!message.trim()) {
      toast.error("Напишите сообщение.");
      return;
    }

    const body = [
      `Тема: ${topic}`,
      name.trim() ? `Имя/ник: ${name.trim()}` : "",
      contact.trim() ? `Связь: ${contact.trim()}` : "",
      matchLink.trim() ? `Матч или турнир: ${matchLink.trim()}` : "",
      "",
      message.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    const mailto = `mailto:${supportEmail}?subject=${encodeURIComponent(`eFootball Nexon: ${topic}`)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    toast.success("Открываем письмо.");
  };

  return (
    <form onSubmit={sendMessage} className="rounded-[2rem] border border-white/10 bg-black/25 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Сообщение</div>
          <h2 className="mt-2 text-2xl font-black text-white">Написать администрации</h2>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={copyEmail} className="self-start">
          <Copy className="mr-2 h-4 w-4" />
          Скопировать email
        </Button>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="topic">Тема</Label>
          <select
            id="topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            className="flex h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {topics.map((item) => (
              <option key={item} value={item} className="bg-zinc-950 text-white">
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="name">Ваш ник</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Например: LeagueStar16" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact">Telegram или email</Label>
            <Input id="contact" value={contact} onChange={(event) => setContact(event.target.value)} placeholder="@username или почта" />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="matchLink">Ссылка на матч или турнир</Label>
          <Input id="matchLink" value={matchLink} onChange={(event) => setMatchLink(event.target.value)} placeholder="Можно оставить пустым" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="message">Что случилось</Label>
          <Textarea
            id="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Опишите ситуацию коротко и приложите счёт, время матча или скриншоты, если это спор."
            className="min-h-[150px]"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-zinc-400">
            Ответ придёт туда, что вы указали в поле связи. Для споров по матчам лучше сразу добавить ссылку на матч.
          </p>
          <Button type="submit" className="shrink-0">
            <Send className="mr-2 h-4 w-4" />
            Отправить
          </Button>
        </div>

        <a href={`mailto:${supportEmail}`} className="inline-flex items-center gap-2 text-sm font-medium text-primary transition hover:text-white">
          <Mail className="h-4 w-4" />
          {supportEmail}
        </a>
      </div>
    </form>
  );
}
