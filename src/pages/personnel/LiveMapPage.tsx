import { useCallback, useEffect, useState } from "react";

import { useVehicleRealtime } from "../../hooks/useVehicleRealtime";
import TrackingMap, { getMarkerStatus } from "../../components/TrackingMap";
import TrackingSidebar from "../../components/TrackingSidebar";
import { dutyTypeIconMap } from "../../components/TrackingSidebar";
import { supabase, type Unit } from "../../lib/supabase";

import { Check, Map } from "lucide-react";
import { useMemo } from "react";

/**
 * Maps each display label to the set of raw `duty_type` values
 * that can appear in patrol logs (both the icon-map key and its
 * underscore-formatted variant, e.g. "Checkpoint" / "CHECKPOINT").
 */
function buildCategoryFilterKeys(): Record<string, Set<string>> {
  const map: Record<string, Set<string>> = {};

  Object.keys(dutyTypeIconMap).forEach((key) => {
    const display = key === "EMERGENCY_SOS" ? "DISTRESS SIGNAL" : key;

    if (!map[display]) map[display] = new Set();

    map[display].add(key);

    const formatted = key
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    map[display].add(formatted);
  });

  return map;
}

export default function LiveMapPage() {
  const { vehicles, logs, personnel } = useVehicleRealtime();

  /**
   * Set of patrol categories (by display label) the user has
   * checked. An empty set means "show every category".
   */
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    () => new Set(),
  );

  /**
   * Set of marker statuses (by display label) the user has checked.
   * Empty set means "show every status".
   */
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(
    () => new Set(),
  );

  const [activeUnit, setActiveUnit] = useState<string | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchUnits = async () => {
      const { data, error } = await supabase
        .from("unit")
        .select("*")
        .order("unit_name", { ascending: true });

      if (!error && data && !cancelled) {
        setUnits(data);
      }
    };

    void fetchUnits();

    return () => {
      cancelled = true;
    };
  }, []);

  const categoryFilterKeys = useMemo(
    () => buildCategoryFilterKeys(),
    [],
  );

  const dutyTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    Object.values(logs).forEach((log) => {
      if (!log.duty_type) return;

      counts[log.duty_type] = (counts[log.duty_type] || 0) + 1;
    });

    return counts;
  }, [logs]);

  /**
   * Toggles a patrol category on/off.
   *
   * `__CLEAR_ALL__` resets the set to empty.
   */
  const handleCategoryToggle = useCallback(
    (displayLabel: string) => {
      setActiveCategories((prev) => {
        if (displayLabel === "__CLEAR_ALL__") {
          return new Set();
        }

        const next = new Set(prev);

        if (next.has(displayLabel)) {
          next.delete(displayLabel);
        } else {
          next.add(displayLabel);
        }

        return next;
      });
    },
    [],
  );

  /**
   * Toggles a marker status on/off.
   *
   * `__CLEAR_STATUSES__` resets the set to empty.
   */
  const handleStatusToggle = useCallback((label: string) => {
    setActiveStatuses((prev) => {
      if (label === "__CLEAR_STATUSES__") {
        return new Set();
      }

      const next = new Set(prev);

      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }

      return next;
    });
  }, []);

  /**
   * Filter the live logs by the active patrol categories AND statuses.
   *
   * When no category/status is selected, all logs are passed through
   * unchanged so the map behaves exactly as before.
   * When one or more categories are selected, only logs whose
   * `duty_type` matches one of the selected categories are kept.
   * When one or more statuses are selected, only logs whose marker
   * status matches at least one selected status are kept.
   */
  const filteredLogs = useMemo(() => {
    const hasCategoryFilter = activeCategories.size > 0;
    const hasStatusFilter = activeStatuses.size > 0;

    if (!hasCategoryFilter && !hasStatusFilter) return logs;

    const filtered: Record<string, typeof logs[string]> = {};

    Object.entries(logs).forEach(([trackingKey, log]) => {
      /*
       * Category filter.
       *
       * If categories are active, the log's duty_type must match
       * at least one active category (by expanding underscores to
       * title-case, e.g. "CHECKPOINT" → "Checkpoint").
       */
      if (hasCategoryFilter) {
        if (!log.duty_type) return;

        const keys = categoryFilterKeys[log.duty_type];

        if (!keys) return;

        let matchesCategory = false;

        for (const category of activeCategories) {
          if (keys.has(category)) {
            matchesCategory = true;

            break;
          }
        }

        if (!matchesCategory) return;
      }

      /*
       * Status filter.
       *
       * If statuses are active, the log's computed marker status
       * must match at least one active status label (mapped to the
       * enum string, e.g. "Moving" → "moving").
       */
      if (hasStatusFilter) {
        const statusLabel = getMarkerStatus(log);

        let matchesStatus = false;

        for (const status of activeStatuses) {
          /*
           * The sidebar display labels are title-cased (e.g.
           * "Moving"), while getMarkerStatus returns lowercase
           * strings ("moving").
           */
          if (status.toLowerCase() === statusLabel) {
            matchesStatus = true;

            break;
          }
        }

        if (!matchesStatus) return;
      }

      filtered[trackingKey] = log;
    });

    return filtered;
  }, [logs, activeCategories, activeStatuses, categoryFilterKeys]);

  return (
    <div className="flex flex-col gap-6 h-full min-h-[750px] pb-6">
      {/* ================================================================
          PAGE TITLE
      ================================================================= */}

      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
            <Map className="w-7 h-7" />
          </div>

          <div className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950">
            <Check className="w-3 h-3 text-white" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Real-time Tracking
          </h1>
        </div>
      </div>

      {/* ================================================================
          MAP + SIDEBAR
      ================================================================= */}

      <div className="flex flex-col lg:flex-row gap-6 flex-1 items-start">
        {/* ==============================================================
            MAP
        ============================================================== */}

        <div className="flex-1 w-full flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-2 min-h-[500px] lg:min-h-[600px] self-stretch transition-colors">
          <div className="flex-1 relative mt-2 min-h-[400px]">
            <TrackingMap
              vehicles={vehicles}
              logs={filteredLogs}
              personnel={personnel}
              unitFilter={activeUnit}
            />
          </div>
        </div>

        {/* ==============================================================
            SIDEBAR
        ============================================================== */}

        <TrackingSidebar
          dutyTypeCounts={dutyTypeCounts}
          onCategoryClick={handleCategoryToggle}
          activeCategories={activeCategories}
          onStatusClick={handleStatusToggle}
          activeStatuses={activeStatuses}
          units={units}
          activeUnit={activeUnit}
          onUnitChange={setActiveUnit}
        />
      </div>
    </div>
  );
}
