import React, { useEffect, useState } from "react";
import { useVehicleRealtime } from "../../hooks/useVehicleRealtime";
import { usePersonnelRealtime } from "../../hooks/usePersonnelRealtime";
import TrackingMap from "../../components/TrackingMap";
import {
  Activity,
  Bike,
  Car,
  Footprints,
  LucideIcon,
  Map as MapIcon,
  Motorbike,
  ShieldCheck,
  Siren,
  Star,
  Waves,
} from "lucide-react";

export default function LiveMapPage() {
  const { vehicles, logs } = useVehicleRealtime();
  const { personnel } = usePersonnelRealtime();

  return (
    <div className="flex flex-col gap-6 h-full min-h-[750px] pb-6">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <MapIcon className="w-5 h-5 text-blue-600" />
          Real-time Tracking of Mobile patrols
        </h2>
      </div>

      {/* Combined Flex Container for Map & Right Sidebar */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 items-start">
        {/* Left Side: Map Area (Stretches to take maximum space) */}
        <div className="flex-1 w-full flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-2 min-h-[500px] lg:min-h-[600px] self-stretch transition-colors">
          <div className="flex-1 relative mt-2 min-h-[400px]">
            <TrackingMap
              vehicles={vehicles}
              logs={logs}
              personnel={personnel}
            />
          </div>
        </div>

        {/* Right Side: Sidebar Legends (Fixed width on desktop, stacked vertically) */}
        <div className="w-full lg:w-72 flex flex-col gap-4 flex-shrink-0">
          {/* Status Legend Box */}
          <div className="flex flex-col gap-3 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b border-slate-200/50 dark:border-slate-700 pb-1.5 mb-0.5">
              Status
            </p>
            <LegendItem color="bg-green-500" label="Active" />
            <LegendItem color="bg-red-500" label="Emergency" />
            <LegendItem color="bg-gray-500" label="No Movement" />
          </div>

          {/* Duty Types Legend Box */}
          <div className="flex flex-col gap-2.5 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b border-slate-200/50 dark:border-slate-700 pb-1.5 mb-0.5">
              Patrol Category
            </p>
            {Object.keys(dutyTypeIconMap).map((label) => {
              let count = 0;
              {
                count = Object.values(logs).filter(
                  (log) => log.duty_type === label,
                ).length;
              }
              return (
                <LegendItem
                  key={label}
                  label={label === "EMERGENCY_SOS" ? "DISTRESS SIGNAL" : label}
                  icon={dutyTypeIconMap[label]}
                  number={count}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export const dutyTypeIconMap: Record<string, LucideIcon> = {
  "Mobile Patrol": Car,
  "TMRU Patrol": Motorbike,
  "Foot Patrol": Footprints,
  "Bike Patrol": Bike,
  "Seaborne Patrol": Waves,
  Checkpoint: ShieldCheck,
  "Simulation Exercise": Activity,
  "Special Event": Star,
  EMERGENCY_SOS: Siren,
};

{
  /* Cleaned up and streamlined LegendItem Component */
}
function LegendItem({
  label,
  number,
  color,
  icon,
}: {
  label: string;
  number?: number;
  color?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {icon ? (
        <div className="w-10 h-10 flex items-center justify-center border border-slate-800 dark:border-slate-200 rounded-full flex-shrink-0">
          {React.createElement(icon, {
            className: `w-6 h-6 ${label === "DISTRESS SIGNAL" ? "text-red-500 animate-pulse" : "text-slate-800 dark:text-slate-200"}`,
          })}
        </div>
      ) : (
        <div
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`}
        ></div>
      )}

      <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider whitespace-nowrap">
        {label}
        {number != undefined ? ` (${number})` : ""}
      </span>
    </div>
  );
}
