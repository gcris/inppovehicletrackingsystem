-- PNP Patrol Tracking System Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Tables
create table unit (
  id uuid primary key default uuid_generate_v4(),
  unit_name text not null
);

create table personnel (
  id uuid primary key references auth.users(id) on delete cascade,
  badge_number text unique,
  rank text not null,
  fullname text not null,
  unit_id uuid references unit(id) on delete cascade,
  is_approved boolean default false,
  role text default 'user' check (role in ('user', 'admin'))
);

create table schedule (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  time_from time not null,
  time_to time not null,
  sector text not null,
  unit_id uuid references unit(id) on delete cascade,
  personnel_id uuid references personnel(id) on delete cascade
);

create table vehicles (
  id uuid primary key default uuid_generate_v4(),
  plate_number text not null unique,
  created_at timestamptz default now(),
  personnel_id uuid references personnel(id) on delete set null,
  unit_id uuid references unit(id) on delete cascade,
  load_status text check (load_status in ('Normal', 'Expired')),
  last_load_update timestamptz default now()
);

create table vehicle_logs (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid references vehicles(id) on delete cascade,
  latitude float8 not null,
  longitude float8 not null,
  speed numeric default 0,
  network_signal int4 default 0,
  captured_at timestamptz default now()
);

-- 2. Indexes
create index idx_vehicle_logs_vehicle_captured on vehicle_logs(vehicle_id, captured_at desc);
create index idx_vehicle_logs_captured on vehicle_logs(captured_at desc);
create index idx_schedule_date_unit on schedule(date, unit_id);
create index idx_schedule_personnel_date on schedule(personnel_id, date);
create index idx_vehicles_unit on vehicles(unit_id);
create index idx_personnel_unit on personnel(unit_id);

-- 3. Row Level Security (RLS)
alter table unit enable row level security;
alter table personnel enable row level security;
alter table schedule enable row level security;
alter table vehicles enable row level security;
alter table vehicle_logs enable row level security;

-- Helper function to check if user is admin
create or replace function is_admin()
returns boolean as $$
begin
  return (
    (auth.jwt() ->> 'email' = 'itsme.gerrycriscariaga@gmail.com')
    OR
    exists (
      select 1 from personnel
      where id = auth.uid()
      and role = 'admin'
      and is_approved = true
    )
  );
end;
$$ language plpgsql security definer;

-- Helper function to get user unit
create or replace function get_user_unit()
returns uuid as $$
begin
  return (
    select unit_id from personnel
    where id = auth.uid()
    and is_approved = true
  );
end;
$$ language plpgsql security definer;

-- Unit Policies
create policy "Admins see all units" on unit for all using (is_admin());
create policy "Users see their own unit" on unit for select using (id = get_user_unit());

-- Personnel Policies
create policy "Admins see all personnel" on personnel for all using (is_admin());
create policy "Users see their unit personnel" on personnel for select using (unit_id = get_user_unit());
create policy "Users can update their own profile" on personnel for update using (id = auth.uid());
create policy "Enable insert for registration" on personnel for insert with check (auth.uid() = id);

-- Schedule Policies
create policy "Admins see all schedules" on schedule for all using (is_admin());
create policy "Users see their unit schedules" on schedule for select using (unit_id = get_user_unit());
create policy "Commanders manage their unit schedules" on schedule for all using (unit_id = get_user_unit());

-- Vehicle Policies
create policy "Admins see all vehicles" on vehicles for all using (is_admin());
create policy "Users see their unit vehicles" on vehicles for select using (unit_id = get_user_unit());
create policy "Commanders manage their unit vehicles" on vehicles for all using (unit_id = get_user_unit());

-- Vehicle Logs Policies
create policy "Admins see all logs" on vehicle_logs for all using (is_admin());
create policy "Users see their unit logs" on vehicle_logs for select using (
  exists (
    select 1 from vehicles v
    where v.id = vehicle_logs.vehicle_id
    and v.unit_id = get_user_unit()
  )
);

-- Realtime: Enable realtime for vehicle_logs
alter publication supabase_realtime add table vehicle_logs;
alter publication supabase_realtime add table vehicles;
