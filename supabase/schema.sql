begin;

create extension if not exists pgcrypto;

-- Live fleet state, verification, occupancy, and current route assignment.
create table if not exists public.buses (
  id uuid primary key default gen_random_uuid(),
  bus_number text not null unique,
  route_id text,
  status text not null default 'standby',
  is_verified boolean not null default false,
  occupancy text not null default 'Low',
  conductor_id text,
  updated_at timestamptz not null default now()
);

-- ONE-TIME DATA NORMALIZATION: converts legacy capitalized bus statuses to lowercase.
-- Do not rerun blindly after real operational data has been collected.
update public.buses
   set status = lower(status);

-- Public route metadata used for ETA, crowding, and demand calculations.
-- WARNING: unconditionally drops and recreates this table on every run.
-- Do NOT rerun this script after real data has been seeded/collected.
drop table if exists public.routes cascade;

create table if not exists public.routes (
  id text primary key,
  name text not null unique,
  base_eta_minutes integer not null default 0,
  base_crowding numeric(5, 2) not null default 0,
  baseline_demand integer not null default 0,
  predicted_demand integer not null default 0,
  created_at timestamptz not null default now()
);

-- Active city disruptions and the route corridors they affect.
-- WARNING: unconditionally drops and recreates this table on every run.
-- Do NOT rerun this script after real data has been seeded/collected.
drop table if exists public.city_signals cascade;

create table if not exists public.city_signals (
  id uuid primary key default gen_random_uuid(),
  signal_name text not null unique,
  signal_type text not null,
  zone text not null,
  affected_routes text[] not null default '{}',
  multiplier numeric(8, 3) not null default 1,
  is_active boolean not null default false,
  occurred_at timestamptz not null default now()
);

-- Passenger travel intent used to forecast demand before departure.
create table if not exists public.commuter_intent (
  id uuid primary key default gen_random_uuid(),
  phone text,
  passenger_name text,
  user_type text not null,
  route_id text not null,
  time_slot text not null,
  created_at timestamptz not null default now()
);

-- Rider reports for driver, conductor, vehicle, delay, and crowding audits.
-- WARNING: unconditionally drops and recreates this table on every run.
-- Do NOT rerun this script after real data has been seeded/collected.
drop table if exists public.feedback cascade;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  bus_number text not null,
  rating integer not null check (rating between 1 and 5),
  comments text not null,
  created_at timestamptz not null default now()
);

-- Demo-only officer lookup via a SECURITY DEFINER RPC; the officers table is not publicly readable.
-- Production authentication should use Supabase Auth and server-side verification.
create table if not exists public.officers (
  id uuid primary key default gen_random_uuid(),
  badge_code text not null unique,
  display_name text,
  created_at timestamptz not null default now()
);

insert into public.routes (id, name, base_eta_minutes, base_crowding, baseline_demand)
values
  ('Route 218', 'Route 218', 8, 88, 140),
  ('Route 113', 'Route 113', 14, 45, 90),
  ('Route 7', 'Route 7', 12, 55, 100)
on conflict (id) do update set
  name = excluded.name,
  base_eta_minutes = excluded.base_eta_minutes,
  base_crowding = excluded.base_crowding;

insert into public.city_signals (signal_name, signal_type, zone, affected_routes, multiplier)
values
  ('Bandh / Strike', 'bandh', 'Route 218', array['Route 218'], 1.50),
  ('Heavy Rain / Waterlogging', 'waterlogging', 'Route 218', array['Route 218', 'Route 113'], 1.35),
  ('Road Work / Construction Detour', 'roadwork', 'Route 113', array['Route 113'], 1.25),
  ('VIP Movement Freeze', 'vip_movement', 'Route 7', array['Route 7'], 1.20),
  ('College Exam / Event Demand Surge', 'exam_surge', 'Route 218', array['Route 218', 'Route 7'], 1.45)
on conflict (signal_name) do update set
  signal_type = excluded.signal_type,
  zone = excluded.zone,
  affected_routes = excluded.affected_routes,
  multiplier = excluded.multiplier;

insert into public.buses (bus_number, route_id, status, is_verified, occupancy)
values
  ('TS09Z1234', 'Route 218', 'standby', false, 'Low'),
  ('TS09Z5678', 'Route 113', 'standby', false, 'Moderate'),
  ('TS09Z9999', 'Route 7', 'standby', false, 'Low')
on conflict (bus_number) do update set
  route_id = excluded.route_id,
  updated_at = now();

insert into public.officers (badge_code, display_name)
values
  ('RTC-4092', 'South Depot Officer'),
  ('RTC-5178', 'Operations Officer'),
  ('RTC-6231', 'Fleet Control Officer')
on conflict (badge_code) do update set
  display_name = excluded.display_name;

alter table public.buses enable row level security;
alter table public.routes enable row level security;
alter table public.city_signals enable row level security;
alter table public.commuter_intent enable row level security;
alter table public.feedback enable row level security;
alter table public.officers enable row level security;

drop policy if exists buses_anon_select on public.buses;
create policy buses_anon_select on public.buses
  for select to anon using (true);

drop policy if exists routes_anon_select on public.routes;
create policy routes_anon_select on public.routes
  for select to anon using (true);

drop policy if exists city_signals_anon_select on public.city_signals;
create policy city_signals_anon_select on public.city_signals
  for select to anon using (true);

drop policy if exists commuter_intent_anon_insert on public.commuter_intent;
create policy commuter_intent_anon_insert on public.commuter_intent
  for insert to anon with check (true);

drop policy if exists commuter_intent_anon_select on public.commuter_intent;
create policy commuter_intent_anon_select on public.commuter_intent
  for select to anon using (true);

drop policy if exists feedback_anon_insert on public.feedback;
create policy feedback_anon_insert on public.feedback
  for insert to anon with check (true);

drop policy if exists feedback_anon_select on public.feedback;
create policy feedback_anon_select on public.feedback
  for select to anon using (true);

drop policy if exists officers_anon_select on public.officers;
revoke select on table public.officers from anon;

create or replace function public.officer_login(badge_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  officer_name text;
begin
  select o.display_name
    into officer_name
    from public.officers as o
   where o.badge_code = $1;

  return officer_name;
end;
$$;

revoke all on function public.officer_login(text) from public;
grant execute on function public.officer_login(text) to anon;

alter table public.buses replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'buses'
  ) then
    alter publication supabase_realtime add table public.buses;
  end if;
exception
  when duplicate_object then null;
end;
$$;

create or replace function public.dispatch_standby(target_route text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_bus_id uuid;
begin
  select id
    into selected_bus_id
    from public.buses
   where status = 'standby'
   order by updated_at, id
   for update skip locked
   limit 1;

  if selected_bus_id is null then
    return null;
  end if;

  update public.buses
     set status = 'repositioning',
         route_id = target_route,
         updated_at = now()
   where id = selected_bus_id;

  return selected_bus_id;
end;
$$;

revoke all on function public.dispatch_standby(text) from public;
revoke execute on function public.dispatch_standby(text) from anon;

create or replace function public.apply_city_signal(
  signal_name text,
  is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  signal_row record;
  predicted integer;
  dispatched boolean := false;
begin
  select cs.zone, cs.multiplier
    into signal_row
    from public.city_signals as cs
   where cs.signal_name = apply_city_signal.signal_name;

  if not found then
    return null;
  end if;

  predicted := case
    when is_active then round((
      select r.baseline_demand * signal_row.multiplier
        from public.routes as r
       where r.name = signal_row.zone
    ))::integer
    else coalesce((
      select r.baseline_demand
        from public.routes as r
       where r.name = signal_row.zone
    ), 0)
  end;

  update public.city_signals
     set is_active = apply_city_signal.is_active,
         occurred_at = now()
   where city_signals.signal_name = apply_city_signal.signal_name;

  update public.routes
     set predicted_demand = predicted
   where routes.name = signal_row.zone;

  if is_active and predicted > 150 then
    dispatched := public.dispatch_standby(signal_row.zone) is not null;
  end if;

  return jsonb_build_object(
    'zone', signal_row.zone,
    'predicted_demand', predicted,
    'standby_bus_dispatched', dispatched
  );
end;
$$;

revoke all on function public.apply_city_signal(text, boolean) from public;
grant execute on function public.apply_city_signal(text, boolean) to anon;

drop function if exists public.register_commute_intent(text, text, text);

create or replace function public.register_commute_intent(
  user_type text,
  route_id text,
  time_slot text,
  phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_count integer;
  registration_count integer;
  threshold_crossed boolean;
  dispatched boolean := false;
begin
  -- Serialize registrations for this route/time slot so only the crossing
  -- transaction can dispatch a standby bus.
  perform pg_advisory_xact_lock(
    hashtext(register_commute_intent.route_id),
    hashtext(register_commute_intent.time_slot)
  );

  select count(*)::integer
    into previous_count
    from public.commuter_intent
   where commuter_intent.route_id = register_commute_intent.route_id
     and commuter_intent.time_slot = register_commute_intent.time_slot;

  insert into public.commuter_intent (user_type, route_id, time_slot, phone)
  values (
    register_commute_intent.user_type,
    register_commute_intent.route_id,
    register_commute_intent.time_slot,
    register_commute_intent.phone
  );

  select count(*)::integer
    into registration_count
    from public.commuter_intent
   where commuter_intent.route_id = register_commute_intent.route_id
     and commuter_intent.time_slot = register_commute_intent.time_slot;

  threshold_crossed := previous_count < 150 and registration_count >= 150;
  if threshold_crossed then
    dispatched := public.dispatch_standby(register_commute_intent.route_id) is not null;
  end if;

  return jsonb_build_object(
    'registration_count', registration_count,
    'threshold_crossed', threshold_crossed,
    'bus_dispatched', dispatched
  );
end;
$$;

revoke all on function public.register_commute_intent(text, text, text, text) from public;
grant execute on function public.register_commute_intent(text, text, text, text) to anon;

create or replace function public.allocate_bus_by_number(
  target_bus_number text,
  target_route text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_bus_id uuid;
begin
  select id
    into selected_bus_id
    from public.buses
   where bus_number = target_bus_number
     and status = 'standby'
   for update skip locked;

  if selected_bus_id is null then
    return null;
  end if;

  update public.buses
     set status = 'repositioning',
         route_id = target_route,
         updated_at = now()
   where id = selected_bus_id;

  return selected_bus_id;
end;
$$;

revoke all on function public.allocate_bus_by_number(text, text) from public;
grant execute on function public.allocate_bus_by_number(text, text) to anon;

create or replace function public.start_conductor_shift(
  target_bus_number text,
  target_conductor_id text,
  target_route text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_bus_id uuid;
begin
  update public.buses
     set status = 'active',
         is_verified = true,
         conductor_id = target_conductor_id,
         route_id = target_route,
         updated_at = now()
   where bus_number = target_bus_number
     and status in ('standby', 'repositioning')
  returning id into updated_bus_id;

  return updated_bus_id;
end;
$$;

revoke all on function public.start_conductor_shift(text, text, text) from public;
grant execute on function public.start_conductor_shift(text, text, text) to anon;

create or replace function public.end_conductor_shift(
  target_bus_number text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_bus_id uuid;
begin
  update public.buses
     set status = 'unverified',
         is_verified = false,
         updated_at = now()
   where bus_number = target_bus_number
     and status in ('active', 'repositioning')
  returning id into updated_bus_id;

  return updated_bus_id;
end;
$$;

revoke all on function public.end_conductor_shift(text) from public;
grant execute on function public.end_conductor_shift(text) to anon;

create or replace function public.report_bus_breakdown(
  target_bus_number text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_bus_id uuid;
  broken_route text;
begin
  update public.buses
     set status = 'breakdown',
         is_verified = false,
         updated_at = now()
   where bus_number = target_bus_number
     and status in ('active', 'repositioning')
  returning id, route_id into updated_bus_id, broken_route;

  if updated_bus_id is not null and broken_route is not null then
    perform public.dispatch_standby(broken_route);
  end if;

  return updated_bus_id;
end;
$$;

revoke all on function public.report_bus_breakdown(text) from public;
grant execute on function public.report_bus_breakdown(text) to anon;

create or replace function public.mark_bus_repaired(
  target_bus_number text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  repaired_bus_id uuid;
begin
  update public.buses
     set status = 'standby',
         is_verified = false,
         conductor_id = null,
         updated_at = now()
   where bus_number = target_bus_number
     and status = 'breakdown'
  returning id into repaired_bus_id;

  return repaired_bus_id;
end;
$$;

revoke all on function public.mark_bus_repaired(text) from public;
grant execute on function public.mark_bus_repaired(text) to anon;

create or replace function public.update_bus_occupancy(
  target_bus_number text,
  target_occupancy text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_bus_id uuid;
begin
  if target_occupancy not in ('Low', 'Moderate', 'Overcrowded', 'Overcrowded (Surge)') then
    raise exception 'Invalid occupancy level: %', target_occupancy;
  end if;

  update public.buses
     set occupancy = target_occupancy,
         updated_at = now()
   where bus_number = target_bus_number
     and status in ('active', 'repositioning')
  returning id into updated_bus_id;

  return updated_bus_id;
end;
$$;

revoke all on function public.update_bus_occupancy(text, text) from public;
grant execute on function public.update_bus_occupancy(text, text) to anon;

commit;
