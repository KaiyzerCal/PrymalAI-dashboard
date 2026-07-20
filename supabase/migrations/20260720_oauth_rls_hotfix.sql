-- HOTFIX: prymal_oauth_tokens was still anonymously readable after the
-- lockdown — the live permissive policy has a name the previous migration
-- didn't guess. Drop every policy on the token tables by name, dynamically.
-- Service role bypasses RLS, so Edge Functions are unaffected.
do $$
declare p record;
begin
  for p in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'prymal_oauth_tokens'
  loop
    execute format('drop policy %I on public.prymal_oauth_tokens', p.policyname);
  end loop;
end $$;
alter table prymal_oauth_tokens enable row level security;

-- Belt and braces: same sweep for any other allow-all leftovers on sensitive tables
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
    where schemaname = 'public'
      and policyname like 'allow_all%'
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
