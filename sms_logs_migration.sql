-- SMS delivery tracking. Run once in the Supabase SQL editor.
create table if not exists public.sms_logs (
  id uuid primary key default gen_random_uuid(),
  event text,
  phone text,
  message text,
  provider_message_id text,
  status text not null default 'SUBMITTING',
  error text,
  sent_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  status_checked_at timestamptz
);

create index if not exists sms_logs_created_at_idx on public.sms_logs (created_at desc);
create index if not exists sms_logs_provider_id_idx on public.sms_logs (provider_message_id);

alter table public.sms_logs enable row level security;

drop policy if exists "Authenticated can read sms logs" on public.sms_logs;
create policy "Authenticated can read sms logs" on public.sms_logs
  for select to authenticated using (true);

drop policy if exists "Authenticated can insert sms logs" on public.sms_logs;
create policy "Authenticated can insert sms logs" on public.sms_logs
  for insert to authenticated with check (sent_by = auth.uid());

drop policy if exists "Authenticated can update sms logs" on public.sms_logs;
create policy "Authenticated can update sms logs" on public.sms_logs
  for update to authenticated using (true) with check (true);
