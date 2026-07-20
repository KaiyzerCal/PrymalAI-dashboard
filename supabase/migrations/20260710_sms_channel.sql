-- SMS channel: phone verification on clients + rolling SMS conversation history
alter table prymal_clients
  add column if not exists phone_number text,
  add column if not exists phone_verified boolean default false,
  add column if not exists phone_verify_code text,
  add column if not exists phone_verify_expires timestamptz;

create unique index if not exists idx_clients_phone on prymal_clients (phone_number) where phone_number is not null;

create table if not exists prymal_sms_history (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references prymal_clients(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz default now()
);
alter table prymal_sms_history enable row level security;
drop policy if exists allow_all_sms_history on prymal_sms_history;
create policy allow_all_sms_history on prymal_sms_history for all using (true) with check (true);
create index if not exists idx_sms_history_client on prymal_sms_history (client_id, created_at desc);
