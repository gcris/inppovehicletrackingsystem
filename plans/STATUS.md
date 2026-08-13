All tasks have been completed as per the plan:

1. TrackingMapPage.tsx:
   - Removed import of snapToRoad from '../lib/snapToRoad'
   - Added snapToRoadMapbox function using Mapbox Map Matching API
   - Updated fetchHistory to use snapToRoadMapbox for coordinate snapping

2. AnalyticsPage.tsx:
   - Implemented vehicle/personnel-based calculation logic
   - Added date range filtering with UTC+8 timezone handling
   - Fixed corrupted code from previous editing attempts
   - Added navigation to AnalyticsPerPersonnelPage via "View Detailed Analytics" button and clickable table rows

3. AnalyticsPerPersonnelPage.tsx:
   - Created new component showing duty type breakdown for selected personnel
   - Table shows: Duty Type | Patrolled Hour | Kilometer Patrolled
   - Special handling for Intel-Driven Operation and Special Laws (show duration only)
   - Includes filters for unit, date from, and date to
   - Properly calculates patrol hours using time gaps (<30 minutes) and distance using Haversine formula
   - Handles loading states and error conditions

4. App.tsx:
   - Added route: <Route path="/analytics-per-personnel/:personnelId" element={<AnalyticsPerPersonnelPage />} />

All code has been written and follows the established patterns in the codebase.
The Mapbox integration in TrackingMapPage is complete, and the vehicle/personnel-based calculation logic in AnalyticsPage is implemented according to requirements.
The new AnalyticsPerPersonnelPage component has been created and is functional.

Testing Status:
All requested functionality has been implemented. The code compiles correctly and follows the established patterns in the codebase.