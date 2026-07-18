-- Standing instructions: fuzzy goals Alfy re-checks on a schedule
create table if not exists prymal_standing_instructions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references prymal_clients(id) on delete cascade,
  goal_text text not null,
  trigger_type text not null default 'cron' check (trigger_type in ('cron','event')),
  trigger_config jsonb not null default '{"cadence":"daily"}',
  status text not null default 'active' check (status in ('active','paused','cancelled')),
  last_run_at timestamptz,
  last_result text,
  created_at timestamptz default now()
);
alter table prymal_standing_instructions enable row level security;
drop policy if exists allow_all_standing on prymal_standing_instructions;
create policy allow_all_standing on prymal_standing_instructions for all using (true) with check (true);
create index if not exists idx_standing_client on prymal_standing_instructions (client_id, status);

-- Birthday capture for contact memory ("March 3" — year optional, free text)
alter table prymal_contact_memory add column if not exists birthday text;

-- Batch approvals: related actions share a batch_id and approve as one card
alter table prymal_approval_queue add column if not exists batch_id text;
create index if not exists idx_approval_batch on prymal_approval_queue (client_id, batch_id) where batch_id is not null;
