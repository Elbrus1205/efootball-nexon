# eFootball Nexon

Турнирная платформа на Next.js 15 App Router, React 18, Prisma 6, PostgreSQL/Supabase, NextAuth, Telegram Mini App и PWA/TWA.

## Локальный запуск

```powershell
npm ci
Copy-Item .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Проверка перед передачей изменений:

```powershell
npm run verify
npm run build
```

## Production и база данных

- `DATABASE_URL` должен указывать на Supabase Transaction Pooler, расположенный рядом с БД. Runtime-код по умолчанию использует 5 соединений на экземпляр приложения; значение задаётся через `PRISMA_CONNECTION_LIMIT`.
- `DIRECT_URL` используется только Prisma CLI для миграций.
- Перед этой версией выполните read-only запрос [preflight-notification-outbox.sql](deploy/sql/preflight-notification-outbox.sql) через Supabase SQL Editor или `psql`. Он должен вернуть 0 строк; найденные дубли pending-заявок нужно вручную разрешить до миграции.
- В существующей production-БД 60 старых миграций уже зарегистрированы без начального baseline. Перед первым deploy этой версии один раз отметьте восстановленный baseline как применённый: `npx prisma migrate resolve --applied 20260425000000_baseline`. Эта команда не создаёт таблицы повторно.
- После baseline выполните `npm run prisma:deploy`. На совершенно новой пустой БД `resolve` не нужен: `prisma:deploy` сам применит baseline и все последующие миграции.
- Приложение не выполняет DDL при старте.
- Не используйте `prisma db push` в production.

Рекомендуемый порядок без автоматического деплоя:

```powershell
npm ci
npx prisma migrate status
npx prisma migrate resolve --applied 20260425000000_baseline # только один раз для существующей БД
npm run prisma:deploy
npm run build
npm start
```

`npm start` автоматически прогревает публичные read-cache маршрутов `/`, `/faq`, `/players`, `/tournaments`, `/ratings`. Прогрев можно отключить через `DISABLE_PUBLIC_ROUTE_WARMUP=1`.

### Nginx microcache

Для пика 20–50 одновременных посетителей перед Node.js нужно подключить два snippet: [http-cache.conf](deploy/nginx/http-cache.conf) внутри верхнего `http {}`, а [server-locations.conf](deploy/nginx/server-locations.conf) внутри существующего TLS `server {}`. Конфигурация:

- кэширует только анонимные `GET/HEAD` для четырёх публичных маршрутов на 10 секунд;
- обходит кэш при session-cookie NextAuth/Auth.js, `Authorization` или `Set-Cookie`;
- не кэширует API, admin, dashboard, Telegram Mini App и личные ответы;
- объединяет одинаковые cache-miss через `proxy_cache_lock`.

Перед reload обязательно выполните `nginx -t`. Тестовые турниры остаются в admin-панели и не попадают в кэшируемый публичный список.

## Периодические задачи

Все endpoints требуют `Authorization: Bearer <CRON_SECRET>` (или `x-cron-secret`):

- `POST /api/notifications/deliver` — каждую минуту; доставляет Telegram/push из outbox с retry.
- `POST /api/tournaments/lifecycle` — каждую минуту; открывает регистрацию и закрывает заполненные турниры.
- `POST /api/tournaments/deadline-reminders` — по расписанию напоминаний; шлёт напоминания за 24 ч / 6 ч / 1 ч до дедлайна тура.
- `POST /api/security/email/reminders` — по расписанию email-напоминаний.
- `POST /api/profile-statuses/expire` — периодическая обработка истёкших статусов.
- `POST /api/telegram/sync-usernames` — раз в сутки; обновляет @username привязанных игроков при смене ника в Telegram.
- `POST /api/ops/digest` — раз в сутки (вечером); отправляет основателям и организаторам одну сводку по платформе (застрявшая доставка, недоступность Telegram-бота, открытые споры, просроченные матчи, заявки на проверке).

### Как это устроено (Supabase pg_cron)

Планировщик живёт в самой БД: расширения `pg_cron` (расписание) и `pg_net` (асинхронный HTTP) шлют `POST` на эти endpoints. Секрет `CRON_SECRET` хранится в **Supabase Vault** под именем `efootball_cron_secret` — задачи читают его оттуда, поэтому в SQL его писать не нужно. Часовой пояс сервера БД — **UTC**, поэтому расписание задаётся в UTC (например, 20:00 МСК = `0 17 * * *`).

Посмотреть текущие задачи:

```sql
select jobid, jobname, schedule, active from cron.job order by jobid;
```

Добавить новую задачу (шаблон — подставьте свой путь, расписание и имя):

```sql
select cron.schedule(
  'efootball-ops-digest',        -- имя задачи
  '0 17 * * *',                  -- расписание в UTC (20:00 МСК)
  $$
  select net.http_post(
    url := 'https://efootball-nexon.com/api/ops/digest',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'efootball_cron_secret' limit 1
      )
    ),
    timeout_milliseconds := 120000
  );
  $$
);
```

Проверить последний ответ endpoint (после ручного вызова или срабатывания задачи):

```sql
select status_code, content from net._http_response order by id desc limit 1;
```

Изменить расписание или удалить задачу:

```sql
select cron.alter_job((select jobid from cron.job where jobname='efootball-ops-digest'), schedule := '0 18 * * *');
select cron.unschedule('efootball-ops-digest');
```

## Проверка платформ

- Web: Chrome/Edge/Safari, ширина 320px–4K.
- PWA/APK (TWA): install flow, offline fallback, push, portrait и landscape.
- Telegram Mini App: auto-login, viewport/back button, регистрация и отправка результата.
- Админ-панель: роли Founder/Admin/Organizer/Judge/Trainee и серверные permissions.

При горизонтальном масштабировании замените process-local rate limiter на общий Redis/Upstash limiter. Outbox и транзакционные блокировки уже поддерживают несколько экземпляров приложения.

## Нагрузочная проверка

Скрипт выполняет только GET-запросы к `/`, `/faq`, `/players`, `/tournaments`, `/ratings`. По умолчанию: 20 параллельных клиентов, 60 запросов на маршрут, бюджет p95 2500 мс.

```powershell
$env:PERF_BASE_URL='http://127.0.0.1:3000'
npm run perf:routes

$env:PERF_BASE_URL='https://efootball-nexon.com'
$env:PERF_CONCURRENCY='50'
$env:PERF_REQUESTS='100'
npm run perf:routes
```

Маршруты и бюджет можно переопределить через `PERF_ROUTES` и `PERF_MAX_P95_MS`.
Для read-only проверки профиля, dashboard, admin и конкретного турнира задайте `PERF_ROUTES` и передайте cookie тестовой сессии через `PERF_AUTH_COOKIE`; скрипт по-прежнему не выполняет write-запросы.
