# eFootTourney

Tournament platform for eFootball Mobile on `Next.js 14`, `Prisma`, `SQLite`, `NextAuth.js`, `Uploadthing`, and `Pusher`.

## Local Run

The project now uses local SQLite by default, so PostgreSQL is not required for a first launch.

Database file location after the first Prisma run:
- `prisma/dev.db`

### 1. Install dependencies

```powershell
npm install
```

### 2. Prepare env

If `.env` does not exist:

```powershell
Copy-Item .env.example .env
```

Minimum required values in `.env`:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-long-secret"
```

### 3. Generate Prisma client

```powershell
npx prisma generate
```

### 4. Create SQLite database and tables

```powershell
npx prisma db push
```

### 5. Seed demo data

```powershell
npm run prisma:seed
```

### 6. Start the site

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

## Demo Admin

After seed:

- Email: `admin@efoottourney.local`
- Password: `Admin12345!`

## Notes

- SQLite is used for local development convenience.
- For production, you can switch Prisma back to PostgreSQL and deploy to Neon or Supabase.
- VK, Telegram, Uploadthing, and Pusher keys can stay empty for a basic UI check.
