-- Replayable agent action log: every tool call Alfy makes, with input/result.
create table if not exists prymal_agent_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references prymal_clients(id) on delete cascade,
  channel text not null default 'web',
  tool_name text not null,
  input jsonb,
  result jsonb,
  ok boolean not null default true,
  duration_ms integer,
  created_at timestamptz default now()
);
alter table prymal_agent_log enable row level security;
create policy own_agent_log_select on prymal_agent_log
  for select using (client_id in (select id from prymal_clients where user_id = auth.uid()));
create index if not exists idx_agent_log_client on prymal_agent_log (client_id, created_at desc);
