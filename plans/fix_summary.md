# Fix for Blank PersonnelTrackingPage

## Issue
The PersonnelTrackingPage was rendering as a blank page, particularly during server-side rendering (SSR) or in environments where the `window` object is not available.

## Root Cause
The component had inconsistent guarding against undefined `window` objects:
- The `<Marker>` component was correctly guarded with `{currentLog && typeof window !== "undefined" && (...)`
- The `<ChangeView>` component was missing this guard: `{currentLog && (<ChangeView ... />)}`

During SSR or in non-browser environments:
1. The Marker would not render (due to the window check)
2. But the ChangeView would still attempt to render
3. Inside ChangeView, `useMap()` from react-leaflet would be called
4. This would fail because the MapContext requires a browser environment
5. The error would cause the entire component to fail rendering, resulting in a blank page

## Fix
Added the same `typeof window !== "undefined"` guard to the ChangeView usage:

```diff
- {currentLog && (
-   <ChangeView
-     lat={currentLog.latitude}
-     lng={currentLog.longitude}
-   />
- )}
+ {currentLog && typeof window !== "undefined" && (
+   <ChangeView
+     lat={currentLog.latitude}
+     lng={currentLog.longitude}
+   />
+ )}
```

## Verification
After the fix:
- Both Marker and ChangeView are now protected by the same window check
- In browser environments: both components render normally when currentLog exists
- In non-browser environments (SSR): neither component renders, preventing errors
- The page should now render correctly in all environments

## Files Modified
- `src/pages/PersonnelTrackingPage.xaml` - Added window guard to ChangeView usage