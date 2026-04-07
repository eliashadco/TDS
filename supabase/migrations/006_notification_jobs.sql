-- Step 18: notification scheduling infrastructure

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Configure these in SQL editor before running the schedules in production:
-- set app.settings.project_url = 'https://<project-ref>.supabase.co';
-- set app.settings.service_role_key = '<service-role-key>';

select
  cron.schedule(
    'tds-tranche-deadline-check-daily',
    '0 14 * * *',
    $$
    select
      net.http_post(
        url := current_setting('app.settings.project_url') || '/functions/v1/tranche-deadline-check',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := '{}'::jsonb
      );
    $$
  );

select
  cron.schedule(
    'tds-watchlist-reeval-weekly',
    '0 22 * * 0',
    $$
    select
      net.http_post(
        url := current_setting('app.settings.project_url') || '/functions/v1/watchlist-reeval',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := '{}'::jsonb
      );
    $$
  );
