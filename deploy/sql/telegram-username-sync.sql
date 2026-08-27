-- Run once in Supabase SQL Editor. The statement is idempotent.
-- Telegram username refresh runs every 12 hours (03:00 and 15:00 Moscow = 00:00 and 12:00 UTC).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid)
from cron.job
where jobname = 'efootball-telegram-username-sync';

select cron.schedule(
  'efootball-telegram-username-sync',
  '0 */12 * * *',
  $$
  select net.http_post(
    url := 'https://efootball-nexon.com/api/telegram/sync-usernames',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'efootball_cron_secret'
        limit 1
      )
    ),
    timeout_milliseconds := 300000
  );
  $$
);

-- Verify with:
-- select jobid, jobname, schedule, active from cron.job
-- where jobname = 'efootball-telegram-username-sync';
