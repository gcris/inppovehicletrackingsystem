# Maintenance History Tracking Implementation Plan

## Problem Statement
The MaintenanceHistoryPage currently only shows current maintenance values (last PMS date, last PMS odometer, next PMS date, etc.) but does not track historical changes to these values. Users need to see the history of maintenance changes for each vehicle.

## Solution Overview
Create a maintenance history tracking system that:
1. Logs changes to maintenance fields in a dedicated history table
2. Displays this history in the MaintenanceHistoryPage UI
3. Uses database triggers to automatically capture changes
4. Provides a clean UI for viewing historical maintenance records

## Implementation Plan

### 1. Database Changes
Create a maintenance history table and trigger to automatically log changes:

```sql
-- Create maintenance history table
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

-- Enable RLS
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
```

Create a trigger function to log changes:
```sql
-- Create function to log maintenance changes
create or replace function log_mobility_asset_maintenance_changes()
returns trigger as $$
declare
  changed_fields text[] := '{}';
begin
  -- Check each maintenance field for changes
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
  
  -- Only log if there are actual changes
  if array_length(changed_fields, 1) > 0 then
    insert into mobility_insert into mobility_assets_maintenance_history (
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
      coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
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

-- Create trigger
create trigger mobility_assets_maintenance_changes
after update of last_pms_date, last_pms_odometer, pms_interval_km, pms_interval_months, next_pms_odometer, next_pms_date
on mobility_assets
for each row execute function log_mobility_asset_maintenance_changes();
```

### 2. Backend Changes (Supabase Types)
Add TypeScript types for the maintenance history:
```typescript
export type MaintenanceHistory = {
  id: string;
  mobility_asset_id: string;
  changed_at: string;
  changed_by: string | null;
  
  // Maintenance fields history
  last_pms_date: string | null;
  last_pms_odometer: number | null;
  pms_interval_km: number | null;
  pms_interval_months: number | null;
  next_pms_odometer: number | null;
  next_pms_date: string | null;
  
  // Changed fields tracking
  changed_fields: string[] | null;
  
  // Related data (optional)
  mobility_asset?: MobilityAsset;
  user?: User;
};
```

### 3. Frontend Changes (MaintenanceHistoryPage.tsx)
Update the MaintenanceHistoryPage component to display maintenance history:

#### State Management
Add state for maintenance history:
```typescript
const [maintenanceHistory, setMaintenanceHistory] = useType<MaintenanceHistory[]>([]);
const [historyLoading, setHistoryLoading] = useState(false);
const [selectedAssetHistory, setSelectedAssetHistory] = useState<MaintenanceHistory[]>([]);
```

#### Data Fetching
Add function to fetch maintenance history for a specific asset:
```typescript
const fetchMaintenanceHistory = async (assetId: string) => {
  try {
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from('mobility_assets_maintenance_history')
      .select(`
        *,
        mobility_asset: mobility_asset_id (
          plate_number,
          vehicle_type
        ),
        changed_by: changed_by (
          id,
          fullname,
          email
        )
      `)
      .eq('mobility_asset_id', assetId)
      .order('changed_at', { ascending: false });
      
    if (error) throw error;
    setMaintenanceHistory(data || []);
  } catch (err) {
    console.error('Error fetching maintenance history:', err);
    setMaintenanceHistory([]);
  } finally {
    setHistoryLoading(false);
  }
};
```

#### ViewDetails Component Enhancement
Modify the ViewDetails component to include a maintenance history tab:
1. Add a "History" tab alongside "Details" and "Edit"
2. When the history tab is selected, fetch and display maintenance history for the selected asset
3. Display history in a table format showing:
   - Date of change
   - Fields that changed
   - Old vs new values (if possible)
   - Who made the change

#### UI Components
Add a maintenance history table component:
```typescript
const MaintenanceHistoryTable = ({ history }: { history: MaintenanceHistory[] }) => {
  if (history.length === 0) {
    return <div className="text-center py-8">No maintenance history found.</div>;
  }
  
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-[var(--text)]/[0.9] mb-2">Maintenance History</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--secondary)]/[0.2]">
          <thead>
            <tr className="bg-[var(--primary)]/[0.05] dark:bg-[var(--primary)]/[0.02]">
              <th className="px-6 py-3 text-[var(--text)]/[0.9] text-left text-sm">Date Changed</th>
              <th className="px-6 py-3 text-[var(--text)]/[0.9] text-left text-sm">Changed By</th>
              <th className="px-6 py-3 text-[var(--text)]/[0.9] text-left text-sm">Fields Changed</th>
              <th className="px-6 py-3 text-[var(--text)]/[0.9] text-left text-sm">Previous Values</th>
              <th className="px-6 py-3 text-[var(--text)]/[0.9] text-left text-sm">New Values</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--secondary)]/[0.2]">
            {history.map((record) => (
              <tr key={record.id} className="bg-[var(--primary)]/[0.02] hover:bg-[var(--secondary)]/[0.03]">
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {format(parseISO(record.changed_at), 'MMM d, yyyy hh:mm a')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {record.changed_by?.fullname || 'System'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {record.changed_fields?.map((field, index) => (
                    <span key={index} className="inline-block bg-[var(--secondary)]/[0.1] text-[var(--secondary)]/[0.8] px-2 py-1 rounded text-xs">
                      {field}
                    </span>
                  )) || []}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {/* Show previous values for changed fields */}
                  {/* This would require storing old values in the history table */}
                  <em>Previous values not tracked</em>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {/* Show current values from the record */}
                  <div className="space-y-1">
                    {record.last_pms_date && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Last PMS Date:</span>
                        <span>{format(parseISO(record.last_pms_date), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                    {record.last_pms_odometer !== null && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Last PMS Odometer:</span>
                        <span>{record.last_pms_odometer.toLocaleString()} km</span>
                      </div>
                    )}
                    {/* Add other fields as needed */}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

### 4. Implementation Steps
1. **Database Layer**: Create the history table and trigger function in Supabase
2. **Type Updates**: Add TypeScript types for the maintenance history
3. **Frontend Updates**: 
   - Add state management for maintenance history
   - Implement data fetching functions
   - Enhance ViewDetails component with history tab
   - Create maintenance history display component
4. **Testing**: Verify that maintenance changes are properly logged and displayed

### 5. Files to Modify
1. `supabase_schema.sql` - Add maintenance history table and trigger
2. `src/lib/supabase.ts` - Add MaintenanceHistory type
3. `src/pages/MaintenanceHistoryPage.tsx` - Main component updates

### 6. Verification
- Test that updating maintenance fields creates history entries
- Verify history displays correctly in the UI
- Ensure proper ordering (most recent first)
- Confirm RLS policies work correctly
- Test edge cases (null values, no changes, etc.)

### 7. Future Enhancements
- Store both old and new values in history for better diff visualization
- Add export functionality for maintenance history
- Add filtering capabilities to the history view
- Add ability to add maintenance notes/comments