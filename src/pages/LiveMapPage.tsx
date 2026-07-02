import React, { useEffect, useState } from "react";
import { useVehicleRealtime } from "../hooks/useVehicleRealtime";
import { usePersonnelRealtime } from "../hooks/usePersonnelRealtime";
import TrackingMap from "../components/TrackingMap";
import { Map as MapIcon } from "lucide-react";

export default function LiveMapPage() {
  const { vehicles, logs } = useVehicleRealtime();
  const { personnel } = usePersonnelRealtime();

  // Calculate vehicles with no movement (stale data - no updates in 5+ minutes)
  const vehicleNoMovementCount = Object.values(logs).reduce((count, log) => {
    const lastUpdated = new Date(log.captured_at);
    const isStale = Date.now() - lastUpdated.getTime() > 5 * 60 * 1000; // 5 minutes
    return count + (isStale ? 1 : 0);
  }, 0);

  // Calculate vehicles with movement (not stale)
  const vehicleMovingCount = Object.values(logs).reduce((count, log) => {
    const lastUpdated = new Date(log.captured_at);
    const isStale = Date.now() - lastUpdated.getTime() > 5 * 60 * 1000; // 5 minutes
    return count + (!isStale ? 1 : 0);
  }, 0);

  return (
    <div className="flex flex-col gap-6 h-full min-h-[750px] pb-6">
      <div>
        <h2 className="text-2xl  text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <MapIcon className="w-5 h-5 text-blue-600" />
          Real-time Tracking of Mobile patrols
        </h2>
      </div>
      {/* Map Container Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-2 min-h-[500px] transition-colors">
        <div className="flex-1 relative mt-2 min-h-[400px]">
          <TrackingMap vehicles={vehicles} logs={logs} personnel={personnel} />
        </div>
      </div>
    </div>
  );
}
