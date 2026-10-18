import { useVehicleRealtime } from "../../hooks/useVehicleRealtime";
import TrackingMap from "../../components/TrackingMap";
import TrackingSidebar from "../../components/TrackingSidebar";

import { Check, Map, Map as MapIcon } from "lucide-react";
import { useMemo } from "react";

export default function LiveMapPage() {
  const { vehicles, logs, personnel } = useVehicleRealtime();

  const dutyTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    Object.values(logs).forEach((log) => {
      if (!log.duty_type) return;

      counts[log.duty_type] = (counts[log.duty_type] || 0) + 1;
    });

    return counts;
  }, [logs]);

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
              logs={logs}
              personnel={personnel}
            />
          </div>
        </div>

        {/* ==============================================================
            SIDEBAR
        ============================================================== */}

        <TrackingSidebar dutyTypeCounts={dutyTypeCounts} />
      </div>
    </div>
  );
}
