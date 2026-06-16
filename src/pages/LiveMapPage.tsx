import React, { useEffect, useState } from "react";
import { useVehicleRealtime } from "../hooks/useVehicleRealtime";
import TrackingMap from "../components/TrackingMap";
import { Map as MapIcon } from "lucide-react";

export default function LiveMapPage() {
  const { vehicles, logs } = useVehicleRealtime();

  // Calculate vehicles with no movement (stale data - no updates in 5+ minutes)
  const noMovementCount = Object.values(logs).reduce((count, log) => {
    const lastUpdated = new Date(log.captured_at);
    const isStale = Date.now() - lastUpdated.getTime() > 5 * 60 * 1000; // 5 minutes
    return count + (isStale ? 1 : 0);
  }, 0);

  // Calculate vehicles with movement (not stale)
  const movingCount = Object.values(logs).reduce((count, log) => {
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
        <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-slate-50 dark:border-slate-800/50">
          <div className="flex flex-row items-center gap-3">
            {/* No Movement Badge */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-50/[0.2] text-red-600 dark:bg-red-500/[0.2] dark:text-red-400 border border-red-500/[0.2] dark:border-red-400/[0.3] ">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
              <span>No Movement: {noMovementCount}</span>
            </div>

            {/* Moving Badge */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-50/[0.2] text-green-600 dark:bg-green-500/[0.2] dark:text-green-400 border border-green-500/[0.2] dark:border-green-400/[0.3]">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
              <span>Moving: {movingCount}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 relative mt-2 min-h-[400px]">
          <TrackingMap vehicles={vehicles} logs={logs} />
        </div>
      </div>
    </div>
  );
}
