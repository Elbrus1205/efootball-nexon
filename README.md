# eFootball Nexon

Tournament platform for eFootball Mobile on `Next.js 14`, `Prisma`, `PostgreSQL`, `NextAuth.js`, `Uploadthing`, and `Pusher`.

## Production Stack

- Frontend: `Next.js 14 App Router`
- Backend: `Route Handlers`
- Database: `PostgreSQL`


### 1. Install dependencies

```powershell
npm install
```

### 2. Prepare env

```powershell
Copy-Item .env.example .env
```


### 3. Generate Prisma client

```powershell
npx prisma generate
```

### 4. Push schema

```powershell
npx prisma db push
```

### 5. Seed demo data

```powershell
npm run prisma:seed
```

### 6. Start app

```powershell
npm run dev
```


Required:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

Optional for extra features:

- `VK_CLIENT_ID`
- `VK_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_BOT_USERNAME`
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
- `NEXT_PUBLIC_TELEGRAM_BOT_ID`
- `UPLOADTHING_SECRET`
- `UPLOADTHING_APP_ID`
- `PUSHER_APP_ID`
- `PUSHER_KEY`
- `PUSHER_SECRET`
- `PUSHER_CLUSTER`
- `NEXT_PUBLIC_PUSHER_KEY`
- `NEXT_PUBLIC_PUSHER_CLUSTER`

## Telegram tournament publishing

When the Telegram bot variables are configured, organizers can connect a tournament to a channel and group from the tournament builder:

- `telegramChannelId` — numeric channel chat ID (usually `-100…`) or `@channel` username used for rich announcements, live bulletins, results, and final recaps.
- `telegramGroupId` — numeric group/supergroup chat ID used by the private tournament commands `/mymatch`, `/deadline`, `/table`, `/schedule`, and `/rules`.
- `telegramCommunityId` — optional Telegram Community identifier used to match commands with the connected tournament.
- `telegramAutoPublish` — enables automatic publication and idempotent bulletin edits for the tournament.

The bot must be an administrator in configured destinations. Rich messages use Bot API 10.2 structured blocks and safely fall back to legacy HTML for ordinary direct messages. Receiver-scoped group commands never fall back to public replies.
