-- Enable INSERT access for public (anon) users to allow self-check-in
create policy "Enable insert for public users"
on public.pool_visits for insert
to anon
with check (true);

-- Optional: Verify the policy was created
select * from pg_policies where tablename = 'pool_visits';
