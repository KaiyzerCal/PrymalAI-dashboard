-- Security lockdown: replace allow_all policies with per-user scoping.
-- Edge Functions use the service role and bypass RLS — unaffected.

-- Helper predicate: rows belong to the signed-in user's client record.
-- prymal_clients: user may only see/update their own row
alter table prymal_clients enable row level security;
drop policy if exists allow_all_clients on prymal_clients;
drop policy if exists allow_all_select on prymal_clients;
create policy own_client_select on prymal_clients
  for select using (user_id = auth.uid());
create policy own_client_update on prymal_clients
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- approval queue: own rows only, read + status updates
alter table prymal_approval_queue enable row level security;
drop policy if exists allow_all_approvals on prymal_approval_queue;
drop policy if exists allow_all_select on prymal_approval_queue;
create policy own_approvals_select on prymal_approval_queue
  for select using (client_id in (select id from prymal_clients where user_id = auth.uid()));
create policy own_approvals_update on prymal_approval_queue
  for update using (client_id in (select id from prymal_clients where user_id = auth.uid()))
  with check (client_id in (select id from prymal_clients where user_id = auth.uid()));

-- contact memory: own rows, full CRUD (Alfy knows → People is editable)
drop policy if exists allow_all_contact_memory on prymal_contact_memory;
create policy own_contact_memory on prymal_contact_memory
  for all using (client_id in (select id from prymal_clients where user_id = auth.uid()))
  with check (client_id in (select id from prymal_clients where user_id = auth.uid()));

-- sms history: own rows, read only from the client side
drop policy if exists allow_all_sms_history on prymal_sms_history;
create policy own_sms_history_select on prymal_sms_history
  for select using (client_id in (select id from prymal_clients where user_id = auth.uid()));

-- standing instructions: own rows, full CRUD (Trust screen revoke = status update)
drop policy if exists allow_all_standing on prymal_standing_instructions;
create policy own_standing on prymal_standing_instructions
  for all using (client_id in (select id from prymal_clients where user_id = auth.uid()))
  with check (client_id in (select id from prymal_clients where user_id = auth.uid()));

-- oauth tokens + api keys: no client-side access at all (service role only)
alter table prymal_oauth_tokens enable row level security;
drop policy if exists allow_all_select on prymal_oauth_tokens;
drop policy if exists allow_all_oauth on prymal_oauth_tokens;

alter table prymal_api_keys enable row level security;
drop policy if exists allow_all_select on prymal_api_keys;
drop policy if exists allow_all_api_keys on prymal_api_keys;

-- Audit follow-up: remaining tables referenced by functions
alter table if exists prymal_gmb_reviews enable row level security;
drop policy if exists allow_all_select on prymal_gmb_reviews;
drop policy if exists allow_all_gmb on prymal_gmb_reviews;
create policy own_gmb_reviews_select on prymal_gmb_reviews
  for select using (client_id in (select id from prymal_clients where user_id = auth.uid()));

alter table if exists prymal_social_posts enable row level security;
drop policy if exists allow_all_select on prymal_social_posts;
drop policy if exists allow_all_social on prymal_social_posts;
create policy own_social_posts_select on prymal_social_posts
  for select using (client_id in (select id from prymal_clients where user_id = auth.uid()));

-- social account tokens: service role only
alter table if exists prymal_social_accounts enable row level security;
drop policy if exists allow_all_select on prymal_social_accounts;
drop policy if exists allow_all_social_accounts on prymal_social_accounts;
