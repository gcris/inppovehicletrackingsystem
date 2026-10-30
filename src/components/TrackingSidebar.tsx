import React from "react";
import {
  Activity,
  Bike,
  Car,
  DroneIcon,
  Footprints,
  LucideIcon,
  Motorbike,
  ShieldCheck,
  Siren,
  Star,
  Waves,
} from "lucide-react";

/*
|--------------------------------------------------------------------------
| DUTY TYPE ICONS
|--------------------------------------------------------------------------
*/

export const dutyTypeIconMap: Record<string, LucideIcon> = {
  "Mobile Patrolling": Car,
  "TMRU Patrolling": Motorbike,
  "Foot Patrolling": Footprints,
  "Bike Patrolling": Bike,
  "Seaborne Patrolling": Waves,
  Checkpoint: ShieldCheck,
  "Simulation Exercise": Activity,
  "Special Event": Star,
  "DODON": DroneIcon,
  EMERGENCY_SOS: Siren,
};

/*
|--------------------------------------------------------------------------
| TYPES
|--------------------------------------------------------------------------
*/

interface TrackingSidebarProps {
  dutyTypeCounts: Record<string, number>;
}

/*
|--------------------------------------------------------------------------
| TRACKING SIDEBAR
|--------------------------------------------------------------------------
*/

const TrackingSidebar = React.memo(function TrackingSidebar({
  dutyTypeCounts,
}: TrackingSidebarProps) {
  return (
    <div className="w-full lg:w-72 flex flex-col gap-4 flex-shrink-0">
      {/* ================================================================
            STATUS LEGEND
        ================================================================= */}

      <div className="flex flex-col gap-3 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
        <p className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b border-slate-200/50 dark:border-slate-700 pb-1.5 mb-0.5">
          Status
        </p>

        <LegendItem color="bg-green-500" label="Active" />

        <LegendItem color="bg-red-500" label="Emergency" />

        <LegendItem color="bg-gray-500" label="No Movement" />
      </div>

      {/* ================================================================
            DUTY TYPES
        ================================================================= */}

      <div className="flex flex-col gap-2.5 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
        <p className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b border-slate-200/50 dark:border-slate-700 pb-1.5 mb-0.5">
          Patrol Category
        </p>

        {Object.keys(dutyTypeIconMap).map((label) => {
          const count = dutyTypeCounts[label] || 0;

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
  );
});

/*
|--------------------------------------------------------------------------
| LEGEND ITEM
|--------------------------------------------------------------------------
*/

function LegendItem({
  label,
  number,
  color,
  icon: Icon,
}: {
  label: string;
  number?: number;
  color?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {Icon ? (
        <div className="w-10 h-10 flex items-center justify-center border border-slate-800 dark:border-slate-200 rounded-full flex-shrink-0">
          <Icon
            className={`w-6 h-6 ${
              label === "DISTRESS SIGNAL"
                ? "text-red-500 animate-pulse"
                : "text-slate-800 dark:text-slate-200"
            }`}
          />
        </div>
      ) : (
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`} />
      )}

      <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider whitespace-nowrap">
        {label}

        {number !== undefined ? ` (${number})` : ""}
      </span>
    </div>
  );
}

export default TrackingSidebar;
