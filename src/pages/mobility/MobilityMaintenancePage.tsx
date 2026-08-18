import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Printer,
  Search,
  Wrench,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../../lib/supabase";
import {
  getMaintenanceStatus,
  type MaintenanceStatus,
} from "../utils/maintenanceStatus";
import { useReactToPrint } from "react-to-print";
import { useAuth } from "../../components/AuthProvider";

type MaintenanceType = {
  id: string;
  code: string;
  name: string;
};

type MaintenanceHistoryItem = {
  id: string;
  maintenance_type_id: string;
  maintenance_type?: MaintenanceType | null;
};

type MaintenanceHistory = {
  id: string;
  mobility_asset_id: string;
  next_service_date: string | null;
  next_service_odometer: number | null;
  created_at?: string;
  updated_at?: string;

  items: MaintenanceHistoryItem[];
};

type MobilityAsset = {
  id: string;
  plate_number: string;
  vehicle_type: string | null;
  current_odometer: number;
  status: string | null;

  unit?: {
    id: string;
    unit_name: string;
  } | null;

  maintenance_history: MaintenanceHistory[];
};

type MaintenanceReminder = {
  asset: MobilityAsset;
  history: MaintenanceHistory;
  items: MaintenanceHistoryItem[];
  status: MaintenanceStatus;
};

const statusConfig: Record<
  MaintenanceStatus,
  {
    label: string;
    icon: typeof CheckCircle2;
    className: string;
  }
> = {
  GOOD: {
    label: "Good",
    icon: CheckCircle2,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
  },

  DUE_SOON: {
    label: "Due Soon",
    icon: Clock3,
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
  },

  OVERDUE: {
    label: "Overdue",
    icon: XCircle,
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400",
  },
};

export default function MobilityMaintenancePage() {
  const navigate = useNavigate();
  const { isAdmin, profile, unitId } = useAuth();

  const [assets, setAssets] = useState<MobilityAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState<"ALL" | MaintenanceStatus>(
    "ALL",
  );

  const [unitFilter, setUnitFilter] = useState<string>("ALL");

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "Mobility Maintenance Report",
  });

  useEffect(() => {
    loadMaintenanceData();
  }, []);

  useEffect(() => {
    if (!isAdmin && unitId) {
      setUnitFilter(unitId);
    }
  }, [isAdmin, unitId]);

  const loadMaintenanceData = async () => {
    setLoading(true);

    try {
      let assetQuery = supabase.from("mobility_assets").select(`
        *,
        unit(
          id,
          unit_name
        ),
        maintenance_history:mobility_assets_maintenance_history(
          *,
          items:mobility_assets_maintenance_history_items(
            *,
            maintenance_type:maintenance_types(*)
          )
        )
      `);

      if (!isAdmin && unitId) {
        assetQuery = assetQuery.eq("unit_id", unitId);
      }

      const { data, error } = await assetQuery;

      if (error) {
        throw error;
      }

      const normalizedAssets: MobilityAsset[] = (data ?? []).map((asset) => ({
        id: asset.id,
        plate_number: asset.plate_number,
        vehicle_type: asset.vehicle_type,
        current_odometer: asset.current_odometer ?? 0,
        status: asset.status,

        unit: Array.isArray(asset.unit)
          ? (asset.unit[0] ?? null)
          : (asset.unit ?? null),

        maintenance_history: Array.isArray(asset.maintenance_history)
          ? asset.maintenance_history.map((history: any) => ({
              id: history.id,
              mobility_asset_id: history.mobility_asset_id,
              next_service_date: history.next_service_date,
              next_service_odometer: history.next_service_odometer,
              created_at: history.created_at,
              updated_at: history.updated_at,

              items: Array.isArray(history.items)
                ? history.items.map((item: any) => ({
                    id: item.id,
                    maintenance_type_id: item.maintenance_type_id,

                    maintenance_type: Array.isArray(item.maintenance_type)
                      ? (item.maintenance_type[0] ?? null)
                      : (item.maintenance_type ?? null),
                  }))
                : [],
            }))
          : [],
      }));

      setAssets(normalizedAssets);
    } catch (error) {
      console.error("Failed to load mobility maintenance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const units = useMemo(() => {
    const unitMap = new Map<string, string>();

    assets.forEach((asset) => {
      if (asset.unit?.id && asset.unit.unit_name) {
        unitMap.set(asset.unit.id, asset.unit.unit_name);
      }
    });

    return Array.from(unitMap.entries())
      .map(([id, unit_name]) => ({
        id,
        unit_name,
      }))
      .sort((a, b) => a.unit_name.localeCompare(b.unit_name));
  }, [assets]);

  /*
   * Convert the nested asset structure into a flat reminder list.
   *
   * One maintenance history can have multiple maintenance items,
   * so each item becomes a reminder row.
   */
  const reminders = useMemo<MaintenanceReminder[]>(() => {
    const result: MaintenanceReminder[] = [];

    assets.forEach((asset) => {
      if (!asset.maintenance_history?.length) {
        return;
      }

      asset.maintenance_history.forEach((history) => {
        const status = getMaintenanceStatus(
          asset.current_odometer ?? 0,
          history.next_service_odometer,
          history.next_service_date,
        );

        result.push({
          asset,
          history,
          items: history.items ?? [],
          status,
        });
      });
    });

    return result;
  }, [assets]);

  /*
   * Search + status filtering
   */
  const filteredReminders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return reminders.filter((item) => {
      const maintenanceNames =
        item.items
          ?.map((maintenanceItem) =>
            maintenanceItem.maintenance_type?.name?.toLowerCase(),
          )
          .filter(Boolean)
          .join(" ") ?? "";

      const maintenanceCodes =
        item.items
          ?.map((maintenanceItem) =>
            maintenanceItem.maintenance_type?.code?.toLowerCase(),
          )
          .filter(Boolean)
          .join(" ") ?? "";

      const matchesSearch =
        !query ||
        item.asset.plate_number?.toLowerCase().includes(query) ||
        item.asset.vehicle_type?.toLowerCase().includes(query) ||
        item.asset.unit?.unit_name?.toLowerCase().includes(query) ||
        maintenanceNames.includes(query) ||
        maintenanceCodes.includes(query);

      const matchesStatus =
        statusFilter === "ALL" || item.status === statusFilter;

      const matchesUnit =
        unitFilter === "ALL" || item.asset.unit?.id === unitFilter;

      return matchesSearch && matchesStatus && matchesUnit;
    });
  }, [reminders, search, statusFilter, unitFilter]);

  const formatDate = (date: string | null) => {
    if (!date) {
      return "—";
    }

    return new Date(date).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatNumber = (value: number | null) => {
    if (value === null || value === undefined) {
      return "—";
    }

    return new Intl.NumberFormat("en-PH").format(value);
  };

  const getMaintenanceNames = (items: MaintenanceHistoryItem[]) => {
    if (!items?.length) {
      return "No maintenance items";
    }

    const names = items
      .map((item) => item.maintenance_type?.name)
      .filter(Boolean);

    if (!names.length) {
      return "Maintenance";
    }

    return names.join(", ");
  };

  const getMaintenanceCodes = (items: MaintenanceHistoryItem[]) => {
    const codes = items
      .map((item) => item.maintenance_type?.code)
      .filter(Boolean);

    return codes.join(", ");
  };

  return (
    <div className="space-y-6">
      {/* =====================================================
          HEADER
      ====================================================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              Maintenance Reminders
            </p>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Monitor preventive maintenance schedules for mobility assets.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Printer className="h-4 w-4" />
            Print Report
          </button>

          <button
            onClick={() => navigate("/pms-history")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Wrench className="h-4 w-4" />
            PMS History
          </button>
        </div>
      </div>

      {/* =====================================================
          SEARCH / FILTER
      ====================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search plate number, vehicle, unit, or maintenance..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Unit Filter */}
          {isAdmin && (
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 lg:w-56"
            >
              <option value="ALL">All Units/Stations</option>

              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unit_name}
                </option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "ALL" | MaintenanceStatus)
            }
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Status</option>
            <option value="OVERDUE">Overdue</option>
            <option value="DUE_SOON">Due Soon</option>
            <option value="GOOD">Good</option>
          </select>
        </div>
      </div>

      {/* =====================================================
          TABLE
      ====================================================== */}
      <div ref={printRef}>
        <div className="mb-6 hidden print:block">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-black">
              Mobility PMS Report
            </h1>

            <p className="mt-1 text-gray-600">
              Preventive Maintenance Service Monitoring
            </p>

            <p className="mt-1 text-gray-500">
              Generated:{" "}
              {new Date().toLocaleString("en-PH", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </p>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[1100px] text-left print:min-w-0 print:w-full print:table-fixed">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                <tr>
                  <th className="px-5 py-4 font-semibold text-slate-500">
                    Mobility
                  </th>

                  <th className="px-5 py-4 font-semibold text-slate-500">
                    Unit/Station
                  </th>

                  <th className="px-5 py-4 font-semibold text-slate-500">
                    PMS Catalog
                  </th>

                  <th className="px-5 py-4 font-semibold text-slate-500">
                    Current Odometer
                  </th>

                  <th className="px-5 py-4 font-semibold text-slate-500">
                    Next Service
                  </th>

                  <th className="px-5 py-4 font-semibold text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-4 print:hidden"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center">
                      <div className="flex flex-col items-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />

                        <p className="mt-3 text-sm text-slate-500">
                          Loading maintenance reminders...
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : filteredReminders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center">
                      <div className="flex flex-col items-center">
                        <AlertTriangle className="h-10 w-10 text-slate-300 dark:text-slate-600" />

                        <p className="mt-3 font-semibold text-slate-700 dark:text-slate-300">
                          No maintenance reminders found
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          Try changing your search or status filter.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredReminders.map((item) => {
                    const config = statusConfig[item.status];
                    const StatusIcon = config.icon;

                    return (
                      <tr
                        key={item.history.id}
                        onClick={() =>
                          navigate(`/pms-history?asset=${item.asset.id}`)
                        }
                        className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        {/* Vehicle */}
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {item.asset.plate_number}
                            </p>

                            <p className="mt-1 text-slate-500">
                              {item.asset.vehicle_type || "Vehicle"}
                            </p>
                          </div>
                        </td>

                        {/* Unit */}
                        <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {item.asset.unit?.unit_name || "—"}
                        </td>

                        {/* Maintenance */}
                        <td className="px-5 py-4">
                          <p className="max-w-[300px] font-medium text-slate-800 dark:text-slate-200">
                            {getMaintenanceNames(item.items)}
                          </p>

                          {getMaintenanceCodes(item.items) && (
                            <p className="mt-1 text-slate-500">
                              {getMaintenanceCodes(item.items)}
                            </p>
                          )}
                        </td>

                        {/* Current Odometer */}
                        <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {formatNumber(item.asset.current_odometer)} km
                        </td>

                        {/* Next Service */}
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {formatDate(item.history.next_service_date)}
                          </p>

                          <p className="mt-1 text-slate-500">
                            {formatNumber(item.history.next_service_odometer)}{" "}
                            km
                          </p>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold ${config.className}`}
                          >
                            <StatusIcon className="h-3.5 w-3.5" />
                            {config.label}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="px-5 py-4 print:hidden">
                          <ChevronRight className="h-5 w-5 text-slate-400" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
