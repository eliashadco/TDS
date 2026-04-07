-- Step 18 fix: use Supabase Vault for cron job secrets instead of app.settings.*

create extension if not exists supabase_vault with schema vault;
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Create or update these secrets in the SQL editor or Vault UI before expecting jobs to succeed:
-- select vault.create_secret('https://<project-ref>.supabase.co', 'tds_project_url');
-- select vault.create_secret('<service-role-key>', 'tds_service_role_key');

do $$
begin
  if exists (select 1 from cron.job where jobname = 'tds-tranche-deadline-check-daily') then
    perform cron.unschedule('tds-tranche-deadline-check-daily');
  end if;

  if exists (select 1 from cron.job where jobname = 'tds-watchlist-reeval-weekly') then
    perform cron.unschedule('tds-watchlist-reeval-weekly');
  end if;
end;
$$;

select
  cron.schedule(
    'tds-tranche-deadline-check-daily',
    '0 14 * * *',
    $$
    select
      net.http_post(
        url := (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'tds_project_url'
        ) || '/functions/v1/tranche-deadline-check',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'tds_service_role_key'
          )
        ),
        body := '{}'::jsonb
      ) as request_id;
    $$
  );

select
  cron.schedule(
    'tds-watchlist-reeval-weekly',
    '0 22 * * 0',
    $$
    select
      net.http_post(
        url := (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'tds_project_url'
        ) || '/functions/v1/watchlist-reeval',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'tds_service_role_key'
          )
        ),
        body := '{}'::jsonb
      ) as request_id;
    $$
  );