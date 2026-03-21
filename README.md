# eFootTourney

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

## Demo Admin

- Email: `admin@efoottourney.local`
- Password: `Admin12345!`

## Deploy to Vercel + Neon

### 1. Create Neon database

- Go to `https://neon.tech`
- Create a project
- Copy the connection string

It looks like:

```env
postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
```

### 2. Add Environment Variables in Vercel

Required:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

Optional for extra features:

- `VK_CLIENT_ID`
- `VK_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
- `UPLOADTHING_SECRET`
- `UPLOADTHING_APP_ID`
- `PUSHER_APP_ID`
- `PUSHER_KEY`
- `PUSHER_SECRET`
- `PUSHER_CLUSTER`
- `NEXT_PUBLIC_PUSHER_KEY`
- `NEXT_PUBLIC_PUSHER_CLUSTER`

### 3. Vercel values example

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
NEXTAUTH_URL=https://your-project.vercel.app
NEXTAUTH_SECRET=your-long-random-secret
```

### 4. Deploy

Import the GitHub repository into Vercel and redeploy after setting env vars.

### 5. Apply schema in production

If needed after deploy:

```powershell
npx prisma db push
```

## Custom Domain

After deploy:

- Open Vercel project
- Go to `Settings -> Domains`
- Add your domain
- Apply DNS records shown by Vercel at your domain registrar

After domain is connected, update:

```env
NEXTAUTH_URL=https://your-domain.com
```
