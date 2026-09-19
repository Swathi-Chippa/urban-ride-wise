create extension if not exists pgcrypto;

create table if not exists public.buses (
  id uuid primary key default gen_random_uuid(),
  bus_number text not null unique,
  route_id text,
  status text not null default 'Standby',
  is_verified boolean not null default false,
  occupancy text not null default 'Low',
  conductor_id text,
  updated_at timestamptz not null default now()
);

create table if not exists public.commuter_intent (
  id uuid primary key default gen_random_uuid(),
  phone text,
  passenger_name text,
  user_type text not null,
  route_id text not null,
  time_slot text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  bus_number text not null,
  rating integer not null check (rating between 1 and 5),
  comments text not null,
  created_at timestamptz not null default now()
);

alter table public.buses disable row level security;
alter table public.commuter_intent disable row level security;
alter table public.feedback disable row level security;
alter table public.buses replica identity full;
alter publication supabase_realtime add table public.buses;

insert into public.buses (bus_number, route_id, status, is_verified, occupancy)
values
  ('TS09Z1234', 'Route 218', 'Standby', false, 'Low'),
  ('TS09Z5678', 'Route 113', 'Standby', false, 'Moderate'),
  ('TS09Z9999', 'Route 7', 'Standby', false, 'Low')
on conflict (bus_number) do update set
  route_id = excluded.route_id,
  updated_at = now();
