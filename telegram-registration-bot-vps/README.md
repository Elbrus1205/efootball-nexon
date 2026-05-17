# Telegram registration bot VPS

Отдельный сервис для Telegram-входа/привязки аккаунта eFootball Nexon.

Сайт остается на Timeweb App Platform, VK-регистрация и NextAuth остаются на сайте. Этот сервис нужен только для Telegram webhook:

1. сайт создает `login_token`;
2. пользователь открывает бота по ссылке `https://t.me/<bot>?start=login_<token>`;
3. этот VPS получает `/start login_<token>`;
4. сервис отмечает токен как подтвержденный в общей PostgreSQL;
5. сайт завершает вход/регистрацию.

## Что загрузить на VPS

Загрузи на VPS всю папку:

```bash
telegram-registration-bot-vps
```

`.env` в репозиторий не добавляй. На VPS создай его вручную по примеру `.env.example`.

## Переменные окружения

### На VPS бота

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public"
TELEGRAM_BOT_TOKEN="123456789:telegram_bot_token"
TELEGRAM_WEBHOOK_SECRET="long-random-secret"
SITE_URL="https://efootball-nexon.ru"
BOT_PUBLIC_WEBHOOK_URL="https://bot.efootball-nexon.ru/telegram/webhook"
PORT="3021"
```

Важно: `TELEGRAM_WEBHOOK_SECRET` должен быть одинаковым здесь и в настройках сайта, если сайт тоже использует этот secret.

### На сайте Timeweb App Platform

На сайте оставь обычные переменные проекта: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, VK OAuth и остальные.

Для Telegram-входа через отдельный VPS достаточно указать:

```env
NEXT_PUBLIC_TELEGRAM_BOT_ID="123456789"
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME="your_bot_username"
TELEGRAM_WEBHOOK_SECRET="тот-же-secret-что-на-VPS"
```

`TELEGRAM_BOT_TOKEN` на сайте можно не хранить, если сайт не отправляет Telegram-рассылки, 2FA-коды и не проксирует Telegram-аватарки. Если эти функции нужны на сайте, токен придется оставить и там тоже.

Telegram webhook должен смотреть на VPS:

```text
https://bot.efootball-nexon.ru/telegram/webhook
```

А не на:

```text
https://efootball-nexon.ru/api/telegram/webhook
```

## Установка на VPS

```bash
cd telegram-registration-bot-vps
npm install
npm run prisma:generate
npm run check
npm run set-webhook
npm start
```

Для постоянного запуска лучше использовать `pm2`:

```bash
npm install -g pm2
pm2 start src/server.mjs --name efootball-telegram-bot
pm2 save
pm2 startup
```

## Nginx пример

Telegram принимает webhook только по HTTPS. Пример proxy на сервис:

```nginx
server {
  server_name bot.efootball-nexon.ru;

  location / {
    proxy_pass http://127.0.0.1:3021;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

После настройки SSL через certbot:

```bash
sudo certbot --nginx -d bot.efootball-nexon.ru
```

## Проверка

```bash
curl https://bot.efootball-nexon.ru/health
```

Должно вернуть:

```json
{"ok":true}
```
