-- PNP Patrol Tracking System Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Tables
create table unit (
  id uuid primary key default uuid_generate_v4(),
  unit_name text not null
);

create table personnel (
  id uuid primary key default uuid_generate_v4(),
  rank text not null,
  fullname text not null,
  unit_id uuid references unit(id) on delete cascade
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
  load_status text check (load_status in ('Available', 'On Patrol', 'Maintenance', 'Emergency')),
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

-- Policies for Admin (Using a hypothetical 'admin' role or custom claim)
-- Note: Simplified for now. Usually checked via auth.jwt() -> 'role'
create policy "Admins have full access" on unit for all using (true);
create policy "Admins have full access" on personnel for all using (true);
create policy "Admins have full access" on schedule for all using (true);
create policy "Admins have full access" on vehicles for all using (true);
create policy "Admins have full access" on vehicle_logs for all using (true);

-- Policies for Unit Commanders (Scoped to their unit)
-- Assuming unit_commander has a unit_id in their metadata
create policy "Commanders manage their unit" 
on personnel for all 
using (unit_id = (auth.jwt() ->> 'unit_id')::uuid);

create policy "Commanders manage their unit schedules" 
on schedule for all 
using (unit_id = (auth.jwt() ->> 'unit_id')::uuid);

-- Realtime: Enable realtime for vehicle_logs
alter publication supabase_realtime add table vehicle_logs;
alter publication supabase_realtime add table vehicles;
