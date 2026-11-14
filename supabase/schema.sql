-- AIRSTARK data model for Supabase.
-- Run this in the Supabase SQL Editor after creating a project and enabling Auth.

create table if not exists public.astronaut_profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  full_name text not null,
  crew_id text not null unique,
  mission text not null,
  crew_role text,
  updated_at timestamptz not null default now()
);

alter table public.astronaut_profiles enable row level security;

drop policy if exists "Users can read their own astronaut profile" on public.astronaut_profiles;
create policy "Users can read their own astronaut profile"
  on public.astronaut_profiles for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own astronaut profile" on public.astronaut_profiles;
create policy "Users can create their own astronaut profile"
  on public.astronaut_profiles for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own astronaut profile" on public.astronaut_profiles;
create policy "Users can update their own astronaut profile"
  on public.astronaut_profiles for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.health_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  astronaut_id text references public.astronaut_profiles(crew_id) on update cascade on delete set null,
  recorded_at timestamptz not null default now(),
  heart_rate_bpm numeric,
  blood_pressure_mmhg text,
  glucose_mg_dl numeric,
  weight_kg numeric,
  height_cm numeric,
  bmi numeric,
  stress_level text,
  diabetes_type text,
  notes text,
  source text not null default 'manual' check (source in ('manual', 'csv', 'watch', 'demo')),
  created_at timestamptz not null default now()
);

create index if not exists health_records_user_recorded_at_idx
  on public.health_records (user_id, recorded_at desc);

alter table public.health_records enable row level security;

drop policy if exists "Users can read their own health records" on public.health_records;
create policy "Users can read their own health records"
  on public.health_records for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can add their own health records" on public.health_records;
create policy "Users can add their own health records"
  on public.health_records for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own health records" on public.health_records;
create policy "Users can update their own health records"
  on public.health_records for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own health records" on public.health_records;
create policy "Users can delete their own health records"
  on public.health_records for delete to authenticated
  using (auth.uid() = user_id);

create table if not exists public.mission_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  severity text not null default 'info' check (severity in ('info', 'attention', 'critical')),
  title text not null,
  message text not null,
  source text not null default 'system',
  read_at timestamptz,
  related_record_id uuid references public.health_records(id) on delete set null
);

create index if not exists mission_notifications_user_created_at_idx
  on public.mission_notifications (user_id, created_at desc);

alter table public.mission_notifications enable row level security;

drop policy if exists "Users can read their own notifications" on public.mission_notifications;
create policy "Users can read their own notifications"
  on public.mission_notifications for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own notifications" on public.mission_notifications;
create policy "Users can create their own notifications"
  on public.mission_notifications for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can mark their own notifications as read" on public.mission_notifications;
create policy "Users can mark their own notifications as read"
  on public.mission_notifications for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
