-- Growth mechanics: invite tracking + the Sunday digest schedule.

create table if not exists prymal_invites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references prymal_clients(id) on delete cascade,
  phone text not null,
  name text,
  status text not null default 'sent' check (status in ('sent','joined')),
  created_at timestamptz default now()
);
alter table prymal_invites enable row level security;
create policy own_invites_select on prymal_invites
  for select using (client_id in (select id from prymal_clients where user_id = auth.uid()));
create index if not exists idx_invites_client on prymal_invites (client_id);

-- Sunday digest, 17:00 UTC weekly. IMPORTANT: replace <INTERNAL_FUNCTION_SECRET>
-- with the real secret when applying (same pattern as prymal-automation-hourly).
-- select cron.schedule(
--   'prymal-sunday-digest', '0 17 * * 0',
--   $$ select net.http_post(
--        url := 'https://josabyyaarhlgepfelid.supabase.co/functions/v1/prymal-digest',
--        headers := jsonb_build_object('x-runner-key', '<INTERNAL_FUNCTION_SECRET>')
--      ) $$
-- );
