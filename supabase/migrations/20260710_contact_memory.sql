-- Alfy relationship memory: persistent per-contact context the agent maintains
create table if not exists prymal_contact_memory (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references prymal_clients(id) on delete cascade,
  contact_email text not null,
  contact_name text,
  company text,
  context_summary text,
  tags text[] default '{}',
  last_interaction timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (client_id, contact_email)
);

alter table prymal_contact_memory enable row level security;

drop policy if exists allow_all_contact_memory on prymal_contact_memory;
create policy allow_all_contact_memory on prymal_contact_memory
  for all using (true) with check (true);

create index if not exists idx_contact_memory_client on prymal_contact_memory (client_id);
create index if not exists idx_contact_memory_tags on prymal_contact_memory using gin (tags);
