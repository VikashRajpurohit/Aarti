-- Unique visitor analytics
create or replace function public.website_unique_counts(
  today_start timestamptz,
  week_start timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return jsonb_build_object(
    'total', (
      select count(distinct visitor_id)
      from public.website_visits
      where visitor_id is not null
    ),
    'today', (
      select count(distinct visitor_id)
      from public.website_visits
      where visitor_id is not null
        and created_at >= today_start
    ),
    'week', (
      select count(distinct visitor_id)
      from public.website_visits
      where visitor_id is not null
        and created_at >= week_start
    ),
    'top_cities', (
      select coalesce(jsonb_agg(jsonb_build_object('city', city, 'count', cnt)), '[]'::jsonb)
      from (
        select city, count(distinct visitor_id) as cnt
        from public.website_visits
        where visitor_id is not null
          and created_at >= week_start
          and city is not null
        group by city
        order by cnt desc
        limit 5
      ) s
    )
  );
end;
$$;

grant execute on function public.website_unique_counts(timestamptz, timestamptz) to authenticated;

-- General manager can end raw material shifts (open only)
drop policy if exists "gm can end raw material shifts" on public.raw_material_entries;
create policy "gm can end raw material shifts"
  on public.raw_material_entries
  for update
  to authenticated
  using (
    ended_at is null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'general_manager' or 'general_manager' = any(p.roles))
    )
  )
  with check (
    ended_at is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'general_manager' or 'general_manager' = any(p.roles))
    )
  );

-- General manager can end production shifts (open only)
drop policy if exists "gm can end production shifts" on public.production_shifts;
create policy "gm can end production shifts"
  on public.production_shifts
  for update
  to authenticated
  using (
    ended_at is null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'general_manager' or 'general_manager' = any(p.roles))
    )
  )
  with check (
    ended_at is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'general_manager' or 'general_manager' = any(p.roles))
    )
  );

-- Allow general manager to upsert production outputs while shift is open
-- (Needed when ending shifts in the Production Output screen)
drop policy if exists "gm can manage production outputs" on public.production_outputs;
create policy "gm can manage production outputs"
  on public.production_outputs
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.production_shifts s
      join public.profiles p on p.id = auth.uid()
      where s.id = production_outputs.shift_id
        and s.ended_at is null
        and (p.role = 'general_manager' or 'general_manager' = any(p.roles))
    )
  );

drop policy if exists "gm can update production outputs" on public.production_outputs;
create policy "gm can update production outputs"
  on public.production_outputs
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.production_shifts s
      join public.profiles p on p.id = auth.uid()
      where s.id = production_outputs.shift_id
        and s.ended_at is null
        and (p.role = 'general_manager' or 'general_manager' = any(p.roles))
    )
  )
  with check (
    exists (
      select 1
      from public.production_shifts s
      join public.profiles p on p.id = auth.uid()
      where s.id = production_outputs.shift_id
        and s.ended_at is null
        and (p.role = 'general_manager' or 'general_manager' = any(p.roles))
    )
  );
