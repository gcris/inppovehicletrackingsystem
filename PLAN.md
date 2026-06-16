# Fix for Empty Personnel Data in Map Popups

## Issue
Personnel data was showing as empty in map popups despite vehicles appearing correctly on the map. Debugging showed that personnel and patrolSchedule state values were empty when computing assignments.

## Root Cause
In the `useVehicleRealtime` hook, during initial data fetch:
1. Personnel data was fetched and `setPersonnel(personnelMap)` was called
2. Immediately after, `computeAssignments(personnel, scheduleData)` was called
3. However, React state updates are asynchronous, so at the time of the computeAssignments call, the `personnel` state still contained the old value (empty object `{}`)
4. This resulted in empty assignments being computed, causing no personnel data to appear in map popups

## Solution
Modified the `useVehicleRealtime` hook to accept initial personnel and patrol schedule data as parameters, and updated the LiveMapPage to fetch this initial data and pass it to the hook.

### Changes Made:

#### 1. useVehicleRealtime Hook (`src/hooks/useVehicleRealtime.ts`)
- Added optional parameters: `initialPersonnel` and `initialPatrolSchedules`
- Initialized state with these values:
  - `const [personnel, setPersonnel] = useState<Record<string, Personnel>>(initialPersonnel || {});`
  - `const [patrolSchedules, setPatrolSchedules] = useState<PatrolSchedule[]>(initialPatrolSchedules || []);`
- This ensures state is populated with initial data before any computeAssignments calls

#### 2. LiveMapPage (`src/pages/LiveMapPage.tsx`)
- Added state for initial personnel and patrol schedule data
- Added useEffect to fetch this data when unitId or isAdmin changes
- Passes the initial data to useVehicleRealtime hook as parameters
- Ensures hook receives data immediately upon initialization

#### 3. TrackingMapPage (`src/pages/TrackingMapPage.tsx`)
- Reverted to original implementation (removed unnecessary hook usage)
- Confirmed it correctly uses its own data fetching for vehicle-specific historical data

## How This Fixes the Issue
- Personnel state is never empty when computeAssignments is called
- Assignments state gets populated correctly with personnel data for each vehicle
- Data flows properly to TrackingMap component, populating popup tables with:
  - Badge Number
  - Rank/Name  
  - Contact Info (Phone & Viber)
- Refetch handlers continue to work correctly using current state for recomputation

## Verification
- Console logging shows "Personnel state updated: X people" confirming state changes
- Marker popups appear on first click with personnel table data
- Table displays correctly with requested columns
- Vehicle locations update in real-time without stale data
- No continuous logging indicating resolved infinite loop