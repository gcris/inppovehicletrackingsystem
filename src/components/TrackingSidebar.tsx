import React from "react";
import {
  Activity,
  Bike,
  Car,
  CheckSquare,
  ChevronDown,
  DroneIcon,
  Footprints,
  LucideIcon,
  Motorbike,
  Square,
  ShieldCheck,
  Siren,
  Star,
  Waves,
  X,
} from "lucide-react";
import type { Unit } from "../lib/supabase";

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
  /**
   * Toggles a patrol category on/off.
   *
   * The caller decides whether to add or remove the label from
   * its own set, so multiple categories can be selected at once.
   */
  onCategoryClick?: (label: string) => void;
  /**
   * Set of currently active patrol categories (by display label).
   * Empty set means "all categories shown".
   */
  activeCategories?: Set<string>;
  /**
   * Toggles a marker status on/off.
   *
   * The caller decides whether to add or remove the status from
   * its own set, so multiple statuses can be selected at once.
   */
  onStatusClick?: (status: string) => void;
  /**
   * Set of currently active marker statuses.
   * Empty set means "all statuses shown".
   */
  activeStatuses?: Set<string>;
  /**
   * Units available for filtering.
   */
  units?: Unit[];
  /**
   * Currently selected unit id, or `null` for "all units".
   */
  activeUnit?: string | null;
  onUnitChange?: (unitId: string | null) => void;
}

/*
|--------------------------------------------------------------------------
| STATUS ITEMS
|--------------------------------------------------------------------------
*/

const STATUS_ITEMS = [
  { label: "Moving", color: "bg-green-500" },
  { label: "Stationary", color: "bg-amber-500" },
  { label: "Emergency", color: "bg-red-500" },
  { label: "Offline", color: "bg-gray-500" },
];

/*
|--------------------------------------------------------------------------
| TRACKING SIDEBAR
|--------------------------------------------------------------------------
*/

const TrackingSidebar = React.memo(function TrackingSidebar({
  dutyTypeCounts,
  onCategoryClick,
  activeCategories,
  onStatusClick,
  activeStatuses,
  units,
  activeUnit,
  onUnitChange,
}: TrackingSidebarProps) {
  const activeSet = activeCategories ?? new Set<string>();
  const activeStatusSet = activeStatuses ?? new Set<string>();

  return (
    <div className="w-full lg:w-72 flex flex-col gap-4 flex-shrink-0">
      {/* ================================================================
            UNIT FILTER
        ================================================================= */}

      {units && units.length > 0 && (
        <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
          <p className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b border-slate-200/50 dark:border-slate-700 pb-1.5 mb-0.5">
            Unit/Station
          </p>

          <UnitSelector
            units={units}
            activeUnit={activeUnit ?? null}
            onUnitChange={onUnitChange ?? (() => {})}
          />
        </div>
      )}

      {/* ================================================================
            STATUS LEGEND
        ================================================================= */}

      <div className="flex flex-col gap-2.5 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b border-slate-200/50 dark:border-slate-700 pb-1.5 mb-0.5">
            Status
          </p>

          {activeStatusSet.size > 0 && (
            <button
              type="button"
              onClick={() => onStatusClick?.("__CLEAR_STATUSES__")}
              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              title="Clear all status filters"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {STATUS_ITEMS.map((item) => {
          const isActive = activeStatusSet.has(item.label);

          return (
            <label
              key={item.label}
              className={`flex w-full items-center gap-2 transition-colors rounded-lg px-1 py-0.5 -mx-1 cursor-pointer ${
                isActive
                  ? "bg-blue-50 dark:bg-blue-900/30"
                  : "hover:bg-slate-100 dark:hover:bg-slate-700/50"
              }`}
              title={`Toggle ${item.label}`}
            >
              <input
                type="checkbox"
                className="peer sr-only"
                checked={isActive}
                onChange={() => onStatusClick?.(item.label)}
              />

              {isActive ? (
                <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
              )}

              <LegendItem color={item.color} label={item.label} active={isActive} />
            </label>
          );
        })}
      </div>

      {/* ================================================================
            DUTY TYPES
        ================================================================= */}

      <div className="flex flex-col gap-2.5 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b border-slate-200/50 dark:border-slate-700 pb-1.5 mb-0.5">
            Patrol Category
          </p>

          {activeSet.size > 0 && (
            <button
              type="button"
              onClick={() => onCategoryClick?.("__CLEAR_ALL__")}
              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              title="Clear all filters"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {Object.keys(dutyTypeIconMap).map((label) => {
          const count = dutyTypeCounts[label] || 0;

          const displayLabel =
            label === "EMERGENCY_SOS" ? "DISTRESS SIGNAL" : label;

          const isActive = activeSet.has(displayLabel);

          return (
            <label
              key={label}
              className={`flex w-full items-center gap-2 transition-colors rounded-lg px-1 py-0.5 -mx-1 cursor-pointer ${
                isActive
                  ? "bg-blue-50 dark:bg-blue-900/30"
                  : "hover:bg-slate-100 dark:hover:bg-slate-700/50"
              }`}
              title={`Toggle ${displayLabel}`}
            >
              <input
                type="checkbox"
                className="peer sr-only"
                checked={isActive}
                onChange={() => onCategoryClick?.(displayLabel)}
              />

              {isActive ? (
                <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
              )}

              <LegendItem
                label={displayLabel}
                icon={dutyTypeIconMap[label]}
                number={count}
                active={isActive}
              />
            </label>
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
  active,
}: {
  label: string;
  number?: number;
  color?: string;
  icon?: LucideIcon;
  active?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {Icon ? (
        <div
          className={`w-10 h-10 flex items-center justify-center border rounded-full flex-shrink-0 transition-colors ${
            active
              ? "border-blue-500 bg-blue-100 dark:bg-blue-900/40"
              : "border-slate-800 dark:border-slate-200"
          }`}
        >
          <Icon
            className={`w-6 h-6 ${
              label === "DISTRESS SIGNAL"
                ? "text-red-500 animate-pulse"
                : active
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-slate-800 dark:text-slate-200"
            }`}
          />
        </div>
      ) : (
        <div
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`}
        />
      )}

      <span
        className={`font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
          active
            ? "text-blue-600 dark:text-blue-400"
            : "text-slate-800 dark:text-slate-200"
        }`}
      >
        {label}

        {number !== undefined ? ` (${number})` : ""}
      </span>
    </div>
  );
}

/*
 |--------------------------------------------------------------------------
| UNIT SELECTOR
 |--------------------------------------------------------------------------
*/

function UnitSelector({
  units,
  activeUnit,
  onUnitChange,
}: {
  units: Unit[];
  activeUnit: string | null;
  onUnitChange: (unitId: string | null) => void;
}) {
  return (
    <div className="relative">
      <select
        value={activeUnit ?? ""}
        onChange={(e) => {
          const value = e.target.value;

          onUnitChange(value ? value : null);
        }}
        className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-3 pr-8 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
      >
        <option value="">All Units</option>

        {units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.unit_name}
          </option>
        ))}
      </select>

      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
    </div>
  );
}

export default TrackingSidebar;
