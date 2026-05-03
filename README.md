# eFootball Nexon

Tournament platform for eFootball Mobile on `Next.js 14`, `Prisma`, `PostgreSQL`, `NextAuth.js`, `Uploadthing`, and `Pusher`.

## Production Stack

- Frontend: `Next.js 14 App Router`
- Backend: `Route Handlers`
- Database: `PostgreSQL`
- Recommended DB host: `Neon`
- Hosting: `Vercel`

## Local Run with PostgreSQL

### 1. Install dependencies

```powershell
npm install
```

### 2. Prepare env

```powershell
Copy-Item .env.example .env
```

Fill `.env` with real values:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-long-random-secret"
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

### 2. Add Environment Variables

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


