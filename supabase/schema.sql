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

-- 4. Evaluación Cardiovascular Completa (Variables de Riesgo / Framingham)
create table if not exists public.cardiovascular_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users(id) on delete cascade,
  astronaut_id text references public.astronaut_profiles(crew_id) on update cascade on delete set null,
  evaluated_at timestamptz not null default now(),

  -- 01. Demográficos y Biometría (F / D)
  sex text check (sex in ('M', 'F')),          -- Sexo (F)
  age integer,                                  -- Edad (F)
  weight_kg numeric,                            -- Peso en kg (D)
  height_cm numeric,                            -- Talla en cm (D)
  bmi numeric,                                  -- IMC (D)

  -- 02. Signos Vitales y Laboratorio Clínico (D)
  heart_rate_bpm numeric,                       -- Frecuencia Cardíaca (D)
  blood_pressure_mmhg text,                     -- Presión Arterial "120/80" (D)
  systolic_bp numeric,                          -- Presión Sistólica (D)
  diastolic_bp numeric,                         -- Presión Diastólica (D)
  glucose_mg_dl numeric,                        -- Glucosa (D)
  tot_chol_mg_dl numeric,                       -- Colesterol Total (D)
  hdl_c_mg_dl numeric,                          -- HDLC (D)
  ldl_c_mg_dl numeric,                          -- LDLC (D)

  -- 03. Hábitos y Medicación (F / D)
  cur_smoke boolean default false,              -- Tabaquismo actual (F)
  cigs_per_day integer default 0,               -- Cigarros por día (D)
  diabetes boolean default false,               -- Diabetes (F)
  bp_meds boolean default false,                -- BPMEDS (F)

  -- 04. Antecedentes Familiares (F)
  prev_chd boolean default false,               -- PREVCHD (F)
  prev_ap boolean default false,                -- PREVAP (F)
  prev_mi boolean default false,                -- PREVMI (F)
  prev_strk boolean default false,              -- PREVSTRK (F)
  prev_hyp boolean default false,               -- PREVHYP (F)

  -- 05. Historial Clínico Personal (D)
  angina boolean default false,                 -- ANGINA (D)
  any_chd boolean default false,                -- ANYCHD (D)
  stroke boolean default false,                 -- STROKE (D)
  cvd boolean default false,                    -- CVD (D)
  hyperten boolean default false,               -- HYPERTEN (D)

  -- 06. Bienestar y Observaciones
  stress_level text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists cardio_evals_user_evaluated_idx
  on public.cardiovascular_evaluations (user_id, evaluated_at desc);

alter table public.cardiovascular_evaluations enable row level security;

drop policy if exists "Users can read their own cardio evaluations" on public.cardiovascular_evaluations;
create policy "Users can read their own cardio evaluations"
  on public.cardiovascular_evaluations for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own cardio evaluations" on public.cardiovascular_evaluations;
create policy "Users can insert their own cardio evaluations"
  on public.cardiovascular_evaluations for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own cardio evaluations" on public.cardiovascular_evaluations;
create policy "Users can update their own cardio evaluations"
  on public.cardiovascular_evaluations for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own cardio evaluations" on public.cardiovascular_evaluations;
create policy "Users can delete their own cardio evaluations"
  on public.cardiovascular_evaluations for delete to authenticated
  using (auth.uid() = user_id);
