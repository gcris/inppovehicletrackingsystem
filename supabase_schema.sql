-- PNP Patrol Tracking System Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Tables
create table unit (
  id uuid primary key default uuid_generate_v4(),
  unit_name text not null
);

create table rank (
  id uuid primary key default uuid_generate_v4(),
  rank_name text not null
);

create table personnel (
  id uuid primary key references auth.users(id) on delete cascade,
  badge_number text unique,
  fullname text not null,
  unit_id uuid references unit(id) on delete cascade,
  designation text,
  duty_status text default 'Active Duty' check (duty_status in ('Active Duty', 'Mandatory Leave', 'Vacation Leave', 'Sick Leave', 'Maternity Leave', 'Paternity Leave', 'Study Leave', 'Emergency Leave', 'Detached Service', 'Suspended', 'AWOL', 'Non-Duty Status', 'Others')),
  remarks text,
  is_approved boolean default false,
  rank_id uuid references rank(id) on delete cascade,
  role text default 'user' check (role in ('user', 'admin'))
);

create table patrol_schedule (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  time_from time not null,
  time_to time not null,
  sector text not null,
  unit_id uuid references unit(id) on delete cascade,
  mobility_id uuid references mobility_assets(id),
  description text
);

create table mobility_assets (
  id uuid primary key default uuid_generate_v4(),
  plate_number text not null unique,
  vehicle_type text, -- e.g., 'Mobile Patrol', 'TMRU', 'Bike Patrol', 'Other'
  load_status text default 'Normal' check (load_status in ('Normal', 'Expired', 'Maintenance')),
  created_at timestamptz default now(),
  personnel_id uuid references personnel(id) on delete set null,
  unit_id uuid references unit(id) on delete cascade,

  -- Maintenance tracking fields
  current_odometer numeric default 0, -- Current odometer reading in km
  -- PMS fields (maintained for backward compatibility)
  last_pms_date date, -- Date of last PMS
  last_pms_odometer numeric default 0, -- Odometer at last PMS
  pms_interval_km numeric default 5000, -- Interval in km for PMS (e.g., 5000)
  pms_interval_months integer default 6, -- Interval in months for PMS (e.g., 6)
  next_pms_odometer numeric, -- Calculated: last_pms_odometer + pms_interval_km
  next_pms_date date -- Calculated: last_pms_date + pms_interval_months
);

-- Maintenance history tracking
create table mobility_assets_maintenance_history (
  id uuid primary key default uuid_generate_v4(),
  mobility_asset_id uuid references mobility_assets(id) on delete cascade,
  changed_at timestamptz default now(),
  changed_by uuid references auth.users(id),

  -- Maintenance fields history
  last_pms_date date,
  last_pms_odometer numeric,
  pms_interval_km numeric,
  pms_interval_months integer,
  next_pms_odometer numeric,
  next_pms_date date,

  -- For tracking what changed
  changed_fields text[] -- Array of field names that were modified
);

-- Enable RLS on maintenance history table
alter table mobility_assets_maintenance_history enable row level security;

-- Policies for maintenance history
create policy "Admins see all maintenance history" on mobility_assets_maintenance_history for all using (is_admin());
create policy "Users see their unit maintenance history" on mobility_assets_maintenance_history for select using (
  exists (
    select 1 from mobility_assets v
    where v.id = mobility_asset_id
    and v.unit_id = get_user_unit()
  )
);

-- Trigger function to log maintenance changes
create or replace function log_mobility_asset_maintenance_change()
returns trigger as $$
declare
  changed_fields text[] := '{}';
begin
  -- Check each maintenance field for changes and build array of changed fields
  if old.last_pms_date is distinct from new.last_pms_date then
    changed_fields := array_append(changed_fields, 'last_pms_date');
  end if;

  if old.last_pms_odometer is distinct from new.last_pms_odometer then
    changed_fields := array_append(changed_fields, 'last_pms_odometer');
  end if;

  if old.pms_interval_km is distinct from new.pms_interval_km then
    changed_fields := array_append(changed_fields, 'pms_interval_km');
  end if;

  if old.pms_interval_months is distinct from new.pms_interval_months then
    changed_fields := array_append(changed_fields, 'pms_interval_months');
  end if;

  if old.next_pms_odometer is distinct from new.next_pms_odometer then
    changed_fields := array_append(changed_fields, 'next_pms_odometer');
  end if;

  if old.next_pms_date is distinct from new.next_pms_date then
    changed_fields := array_append(changed_fields, 'next_pms_date');
  end if;

  -- Only log if any maintenance fields changed
  if array_length(changed_fields, 1) > 0 then
    insert into mobility_assets_maintenance_history (
      mobility_asset_id,
      changed_by,
      last_pms_date,
      last_pms_odometer,
      pms_interval_km,
      pms_interval_months,
      next_pms_odometer,
      next_pms_date,
      changed_fields
    ) values (
      new.id,
      coalesce(nullif(auth.uid(), '')::uuid, null),
      new.last_pms_date,
      new.last_pms_odometer,
      new.pms_interval_km,
      new.pms_interval_months,
      new.next_pms_odometer,
      new.next_pms_date,
      changed_fields
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Create trigger to fire after updates to maintenance fields
create trigger mobility_assets_maintenance_changes
after update of last_pms_date, last_pms_odometer, pms_interval_km, pms_interval_months, next_pms_odometer, next_pms_date
on mobility_assets
for each row execute function log_mobility_asset_maintenance_change();

create table patrol_logs (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid references mobility_assets(id) on delete cascade,
  latitude float8 not null,
  longitude float8 not null,
  speed numeric default 0,
  network_signal int4 default 0,
  captured_at timestamptz default now(),
  remarks text,
  duty_type text,
  personnel_id uuid references personnel(id) on delete restrict on update cascade
);

-- 2. Indexes
create index idx_patrol_logs_vehicle_captured on patrol_logs(vehicle_id, captured_at desc);
create index idx_patrol_logs_captured on patrol_logs(captured_at desc);
create index idx_patrol_schedule_date_unit on patrol_schedule(date, unit_id);
create index idx_patrol_schedule_personnel_date on patrol_schedule(mobility_id, date);
create index idx_mobility_assets_unit on mobility_assets(unit_id);
create index idx_personnel_unit on personnel(unit_id);

-- 3. Row Level Security (RLS)
alter table unit enable row level security;
alter table personnel enable row level security;
alter table patrol_schedule enable row level security;
alter table mobility_assets enable row level security;
alter table patrol_logs enable row level security;

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
$$ language plpgsql security definer stable;

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
$$ language plpgsql security definer stable;

-- Unit Policies
create policy "Admins see all units" on unit for all using (is_admin());
create policy "Users see their own unit" on unit for select using (id = get_user_unit());

-- Personnel Policies
create policy "Admins see all personnel" on personnel for all using (is_admin());
create policy "Users see their unit personnel" on personnel for select using (unit_id = get_user_unit());
create policy "Users can update their own profile" on personnel for update using (id = auth.uid());
create policy "Enable insert for registration" on personnel for insert with check (auth.uid() = id);

-- Schedule Policies
create policy "Admins see all schedules" on patrol_schedule for all using (is_admin());
create policy "Users see their unit schedules" on patrol_schedule for select using (unit_id = get_user_unit());
create policy "Commanders manage their unit schedules" on patrol_schedule for all using (unit_id = get_user_unit());

-- Mobility Assets Policies
create policy "Admins see all mobility assets" on mobility_assets for all using (is_admin());
create policy "Users see their unit mobility assets" on mobility_assets for select using (unit_id = get_user_unit());
create policy "Commanders manage their unit mobility assets" on mobility_assets for all using (unit_id = get_user_unit());

-- Vehicle Logs Policies
create policy "Admins see all logs" on patrol_logs for all using (is_admin());
create policy "Users see their unit logs" on patrol_logs for select using (
  exists (
    select 1 from mobility_assets v
    where v.id = patrol_logs.vehicle_id
    and v.unit_id = get_user_unit()
  )
);

-- Realtime: Enable realtime for patrol_logs
alter publication supabase_realtime add table patrol_logs;
alter publication supabase_realtime add table mobility_assets;

-- 3. Duty Shifts Table
create table duty_shifts (
  id uuid primary key default uuid_generate_v4(),
  shift_name text not null,
  time_start time not null,
  time_end time not null,
  is_overnight boolean default false,
  created_at timestamptz default now()
);

-- Enable RLS on duty_shifts
alter table duty_shifts enable row level security;

-- Policies for duty_shifts
create policy "Admins see all duty shifts" on duty_shifts for all using (is_admin());
create policy "Users see duty shifts" on duty_shifts for select using (true);

-- 4. Shift Assignments Table
create table shift_assignments (
  id uuid primary key default uuid_generate_v4(),
  personnel_id uuid references personnel(id) on delete cascade,
  shift_id uuid references duty_shifts(id) on delete cascade,
  unit_id uuid references unit(id),
  duty_date date not null,
  created_at timestamptz default now(),
  unique(personnel_id, duty_date) -- Ensure personnel can only have one assignment per day
);

-- Enable RLS on shift_assignments
alter table shift_assignments enable row level security;

-- Policies for shift_assignments
create policy "Admins see all shift assignments" on shift_assignments for all using (is_admin());
create policy "Users see shift assignments" on shift_assignments for select using (
  unit_id = get_user_unit()
);
create policy "Users can create shift assignments" on shift_assignments for insert with check (
  unit_id = get_user_unit()
);
create policy "Users can update their own shift assignments" on shift_assignments for update using (
  personnel_id = auth.uid()
);
create policy "Users can delete their own shift assignments" on shift_assignments for delete using (
  personnel_id = auth.uid()
);

-- 5. Seed Data
insert into duty_shifts (shift_name, time_start, time_end, is_overnight) values
('Day Shift', '06:00:00', '18:00:00', false),
('Night Shift', '18:00:00', '06:00:00', true),
('Morning Shift', '08:00:00', '16:00:00', false),
('Evening Shift', '16:00:00', '00:00:00', false);

insert into unit (unit_name) values
('Laoag City PS'),
('Batac City PS'),
('Bacarra MPS'),
('Badoc MPS'),
('Bangui MPS'),
('Banna MPS'),
('Currimao MPS'),
('Dingras MPS'),
('Espiritu MPS'),
('Marcos MPS'),
('Nueva Era MPS'),
('Pagudpud MPS'),
('Paoay MPS'),
('Pasuquin MPS'),
('Piddig MPS'),
('Pinili MPS'),
('San Nicolas MPS'),
('Sarrat MPS'),
('Solsona MPS'),
('Vintar MPS'),
('Provincial Headquarters');