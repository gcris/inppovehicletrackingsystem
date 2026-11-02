import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase, Unit, PatrolSchedule } from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";
import {
  BarChart3,
  FileText,
  RefreshCcw,
  Check,
  Route,
  Clock,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useTheme } from "../../components/ThemeProvider";
import { Link } from "react-router-dom";

/* ============================================================================
   CONSTANTS
============================================================================ */

const PERSONNEL_CHUNK = 100; // ids per .in() request (keeps URLs short)

const patrolTypes = [
  "Mobile Patrolling",
  "Foot Patrolling",
  "TMRU Patrolling",
  "Bike Patrolling",
  "Seaborne Patrolling",
  "Checkpoint",
  "Simulation Exercise",
  "Special Event",
  "DODON",
  "Intel-Driven Operation",
  "Special Laws",
  "Combat/Prophylactic Patrolling",
];

const EMPTY_SUMMARY = {
  total_personnel: 0,
  total_patrol_hours: "00:00:00",
  total_man_hours: 0,
  total_kilometers: 0,
};

/* ============================================================================
   TYPES
============================================================================ */

/** Shape returned by the SQL function analytics_patrol_stats. */
interface PatrolStats {
  daily: { day: string; sessions: number; hours: number; km: number }[];
  hourly: { hour: number; sessions: number; hours: number; km: number }[];
  foot: { personnel_id: string; patrol_minutes: number; km: number }[];
  vehicles: {
    vehicle_id: string;
    patrols: number;
    km: number;
    gap_minutes: number;
    personnel_ids: string[];
  }[];
}

/* ============================================================================
   HELPERS
============================================================================ */

const getLocalDateString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatHHMMSS = (totalMinutes: number) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:00`;
};

const round2 = (value: number) => Number(Number(value ?? 0).toFixed(2));

/**
 * Parses a "HH:MM:SS" string into total minutes for sorting purposes.
 */
function parseHHMMSSMinutes(value: string | null | undefined): number {
  if (!value) return 0;
  const parts = value.split(":");
  if (parts.length !== 3) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

function groupBy<T>(
  items: T[],
  keyFn: (item: T) => string | null | undefined,
): Map<string, T[]> {
  const map = new Map<string, T[]>();

  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;

    const group = map.get(key);
    if (group) {
      group.push(item);
    } else {
      map.set(key, [item]);
    }
  }

  return map;
}

function scheduleMinutes(schedule: PatrolSchedule): number {
  const start = new Date(`${schedule.date}T${schedule.time_from}`);
  const end = new Date(`${schedule.date}T${schedule.time_to}`);

  if (end < start) {
    end.setDate(end.getDate() + 1);
  }

  return (end.getTime() - start.getTime()) / 60000;
}

/* ============================================================================
   DATA FETCHING
============================================================================ */

/**
 * PERF: the database does the heavy work (sessions, distances, patrol minutes)
 * and returns only summary rows. See analytics_patrol_stats.sql.
 */
async function fetchPatrolStats(
  unit: string | null,
  dateFrom: string,
  dateTo: string,
  dutyType: string,
): Promise<PatrolStats> {
  const { data, error } = await supabase.rpc("analytics_patrol_stats", {
    p_from: dateFrom,
    p_to: dateTo,
    p_unit: unit,
    p_duty_type: dutyType || null,
  });

  if (error) throw error;

  const stats = (data ?? {}) as Partial<PatrolStats>;

  return {
    daily: stats.daily ?? [],
    hourly: stats.hourly ?? [],
    foot: stats.foot ?? [],
    vehicles: stats.vehicles ?? [],
  };
}

/**
 * Schedules are only used for their date/time window, vehicle and the number
 * of assigned personnel, so only those columns are requested.
 */
async function fetchSchedules(
  unitId: string | null,
  dateFrom: string,
  dateTo: string,
): Promise<PatrolSchedule[]> {
  try {
    let query: any = supabase
      .from("patrol_schedule")
      .select(
        "id, date, time_from, time_to, mobility_id, schedule_assignments(personnel_id)",
      )
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .order("date", { ascending: true })
      .order("time_from", { ascending: true });

    // ADJUST "unit_id" to the real column name in patrol_schedule.
    if (unitId) {
      query = query.eq("unit_id", unitId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data ?? []) as unknown as PatrolSchedule[];
  } catch (error) {
    console.error("Error fetching schedules:", error);
    return [];
  }
}

/** Loads details only for the personnel that appear in the statistics. */
async function fetchPersonnelMap(ids: string[]): Promise<Map<string, any>> {
  const map = new Map<string, any>();

  if (ids.length === 0) return map;

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += PERSONNEL_CHUNK) {
    chunks.push(ids.slice(i, i + PERSONNEL_CHUNK));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      supabase
        .from("personnel")
        .select(
          "id, badge_number, fullname, designation, phone_number, viber_number, unit_id, rank(id, rank_name)",
        )
        .in("id", chunk),
    ),
  );

  for (const result of results) {
    if (result.error) throw result.error;
    (result.data ?? []).forEach((person: any) => map.set(person.id, person));
  }

  return map;
}

/* ============================================================================
   BUILD THE PAGE DATA (small: a few dozen rows)
============================================================================ */

function buildStatistics(
  stats: PatrolStats,
  schedules: PatrolSchedule[],
  personnelMap: Map<string, any>,
) {
  /* ---------------------------------------------------------------------
     TRENDS
  --------------------------------------------------------------------- */

  const dailyTrend = stats.daily.map((row) => ({
    date: new Date(`${row.day}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    sessions: Number(row.sessions),
    patrolHours: round2(row.hours),
    manHours: round2(row.hours),
    kilometers: round2(row.km),
  }));

  const hourlyTrend = stats.hourly.map((row) => ({
    hour: `${String(row.hour).padStart(2, "0")}:00`,
    sessions: Number(row.sessions),
    patrolHours: round2(row.hours),
    manHours: round2(row.hours),
    kilometers: round2(row.km),
  }));

  /* ---------------------------------------------------------------------
     TOTALS + PER-PERSONNEL STATS
  --------------------------------------------------------------------- */

  let totalKilometers = 0;
  let totalPatrolMinutes = 0;
  let totalManMinutes = 0;

  const personnelStats = new Map<
    string,
    { patrolMinutes: number; kilometers: number }
  >();

  const addPersonnel = (id: string, minutes: number, km: number) => {
    const existing = personnelStats.get(id);

    if (existing) {
      existing.patrolMinutes += minutes;
      existing.kilometers += km;
    } else {
      personnelStats.set(id, { patrolMinutes: minutes, kilometers: km });
    }
  };

  // ---- Foot patrolling ----
  stats.foot.forEach((row) => {
    const minutes = Number(row.patrol_minutes ?? 0);
    const km = Number(row.km ?? 0);

    totalPatrolMinutes += minutes;
    totalManMinutes += minutes;
    totalKilometers += km;

    addPersonnel(row.personnel_id, minutes, km);
  });

  // ---- Vehicle patrolling ----
  const schedulesByVehicle = groupBy(
    schedules,
    (schedule) => (schedule as any).mobility_id,
  );

  stats.vehicles.forEach((row) => {
    const km = Number(row.km ?? 0);
    const matchedSchedules = schedulesByVehicle.get(row.vehicle_id) ?? [];

    let patrolMinutes = 0;

    if (matchedSchedules.length > 0) {
      matchedSchedules.forEach((schedule) => {
        const minutes = scheduleMinutes(schedule);
        const assignedCount = schedule.schedule_assignments?.length ?? 0;

        patrolMinutes += minutes;
        // Man-minutes per schedule = its own duration x its own crew size.
        totalManMinutes += minutes * assignedCount;
      });
    } else {
      patrolMinutes = Number(row.gap_minutes ?? 0);
    }

    totalPatrolMinutes += patrolMinutes;
    totalKilometers += km;

    // Everyone seen in this vehicle's logs shares its stats.
    (row.personnel_ids ?? []).forEach((personId) => {
      addPersonnel(personId, patrolMinutes, km);
    });
  });

  /* ---------------------------------------------------------------------
     PERSONNEL LIST + SUMMARY
  --------------------------------------------------------------------- */

  const personnelData: any[] = [];

  personnelStats.forEach((value, personId) => {
    const person = personnelMap.get(personId);

    if (!person) return;

    personnelData.push({
      ...person,
      patrol_hours: formatHHMMSS(value.patrolMinutes),
      kilometer_patrolled: value.kilometers.toFixed(2),
    });
  });

  personnelData.sort((a, b) =>
    (a.fullname || "").localeCompare(b.fullname || ""),
  );

  return {
    summary: {
      total_personnel: personnelData.length,
      total_patrol_hours: formatHHMMSS(totalPatrolMinutes),
      total_man_hours: Number((totalManMinutes / 60).toFixed(2)),
      total_kilometers: Number(totalKilometers.toFixed(2)),
    },
    personnelData,
    dailyTrend,
    hourlyTrend,
  };
}

/* ============================================================================
   PAGE
============================================================================ */

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState(getLocalDateString);
  const [dateTo, setDateTo] = useState(getLocalDateString);

  const [personnelData, setPersonnelData] = useState<any[]>([]);
  const [dailyTrend, setDailyTrend] = useState<any[]>([]);
  const [hourlyTrend, setHourlyTrend] = useState<any[]>([]);
  const [trendType, setTrendType] = useState<"daily" | "hourly">("daily");
  const [trendMetric, setTrendMetric] = useState<
    "sessions" | "patrolHours" | "manHours" | "kilometers"
  >("sessions");
  const theme = useTheme();
  const [summary, setSummary] = useState(EMPTY_SUMMARY);

  const [sortColumn, setSortColumn] = useState<
    "patrol_hours" | "kilometer_patrolled" | "fullname" | "badge_number"
  >("kilometer_patrolled");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const { unitId, isAdmin, profile } = useAuth();

  const isAdminSafe = isAdmin ?? false;
  const unitIdSafe = unitId !== null && unitId !== undefined ? unitId : null;

  const [searchTerm, setSearchTerm] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  // Non-admin users are locked to their own unit; admins start with "all".
  const [selectedUnit, setSelectedUnit] = useState<string | null>(
    unitIdSafe ?? null,
  );
  const [selectedPatrolType, setSelectedPatrolType] = useState<string>("");

  const userUnitId: string | null = profile?.unit_id ?? null;

  // Non-admin users can only ever see their own unit's data.
  const effectiveUnit: string | null = isAdmin
    ? selectedUnit && selectedUnit !== "all"
      ? selectedUnit
      : null
    : userUnitId;

  const visibleUnits = isAdminSafe
    ? units
    : units.filter((unit) => unit.id === unitIdSafe);

  const filteredPersonnel = useMemo(() => {
    const term = searchTerm.toLowerCase();

    let filtered = !term
      ? personnelData
      : personnelData.filter(
          (person) =>
            person.badge_number?.toLowerCase().includes(term) ||
            person.fullname?.toLowerCase().includes(term) ||
            person.rank?.rank_name?.toLowerCase().includes(term) ||
            person.phone_number?.toLowerCase().includes(term) ||
            person.viber_number?.toLowerCase().includes(term),
        );

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      if (sortColumn === "patrol_hours") {
        // patrol_hours is "HH:MM:SS" — convert to minutes for comparison
        aVal = parseHHMMSSMinutes(a.patrol_hours);
        bVal = parseHHMMSSMinutes(b.patrol_hours);
      } else if (sortColumn === "kilometer_patrolled") {
        aVal = Number(a.kilometer_patrolled ?? 0);
        bVal = Number(b.kilometer_patrolled ?? 0);
      } else {
        aVal = String(a[sortColumn] ?? "").toLowerCase();
        bVal = String(b[sortColumn] ?? "").toLowerCase();
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [personnelData, searchTerm, sortColumn, sortDirection]);

  // Tailwind only generates classes it can find as complete strings.
  const filterGridCols = isAdminSafe ? "xl:grid-cols-5" : "xl:grid-cols-4";

  const handleSort = useCallback((column: typeof sortColumn) => {
    setSortColumn((prev) => {
      if (prev === column) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDirection("asc");
      return column;
    });
  }, []);

  const getSortIcon = (column: typeof sortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-4 h-4 opacity-40" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="w-4 h-4" />
    ) : (
      <ArrowDown className="w-4 h-4" />
    );
  };

  /* --------------------------------------------------------------------------
     UNITS (dropdown data)
  -------------------------------------------------------------------------- */

  const loadUnits = async () => {
    try {
      let query = supabase
        .from("unit")
        .select("*")
        .order("unit_name", { ascending: true });

      // Non-admins only see their own unit
      if (!isAdmin && userUnitId) {
        query = query.eq("id", userUnitId);
      }

      const { data: unitsData, error } = await query;
      if (error) throw error;
      setUnits(unitsData ?? []);
    } catch (error) {
      console.error("Error loading units:", error);
    }
  };

  /* --------------------------------------------------------------------------
     LOAD ANALYTICS
  -------------------------------------------------------------------------- */

  // Used to ignore results from a load that was superseded by a newer one
  // (e.g. the user changed a filter while the previous load was running).
  const requestIdRef = useRef(0);

  const loadAnalytics = useCallback(async () => {
    console.log("[analytics] start", { isAdmin, userUnitId, effectiveUnit, dateFrom, dateTo });

    const requestId = ++requestIdRef.current;
    const isCurrent = () => requestId === requestIdRef.current;

    setLoading(true);
    setErrorMessage(null);

    try {
      // Fail closed: a non-admin without a unit must never see everything.
      if (!isAdmin && !userUnitId) {
        setSummary(EMPTY_SUMMARY);
        setPersonnelData([]);
        setDailyTrend([]);
        setHourlyTrend([]);
        return;
      }

      if (!dateFrom || !dateTo) {
        return;
      }

      console.log("[analytics] sending requests");
      // Statistics and schedules do not depend on each other: load together.
      const [stats, schedulesData] = await Promise.all([
        fetchPatrolStats(effectiveUnit, dateFrom, dateTo, selectedPatrolType),
        fetchSchedules(effectiveUnit, dateFrom, dateTo),
      ]);
      console.log("[analytics] data received");

      if (!isCurrent()) return;

      // Fetch details only for the people who appear in the statistics.
      const personnelIds = Array.from(
        new Set([
          ...stats.foot.map((row) => row.personnel_id),
          ...stats.vehicles.flatMap((row) => row.personnel_ids ?? []),
        ]),
      );

      const personnelMap = await fetchPersonnelMap(personnelIds);

      if (!isCurrent()) return;

      const result = buildStatistics(stats, schedulesData, personnelMap);

      setSummary(result.summary);
      setPersonnelData(result.personnelData);
      setDailyTrend(result.dailyTrend);
      setHourlyTrend(result.hourlyTrend);
    } catch (err: any) {
      console.error("Error loading analytics:", err);

      if (isCurrent()) {
        const message: string = err?.message ?? "";

        setErrorMessage(
          message.includes("statement timeout")
            ? "The query took too long. Try a shorter date range or select a unit."
            : message || "Failed to load analytics.",
        );
      }
    } finally {
      if (isCurrent()) {
        setLoading(false);
      }
    }
  }, [
    isAdmin,
    userUnitId,
    effectiveUnit,
    dateFrom,
    dateTo,
    selectedPatrolType,
  ]);

  useEffect(() => {
    loadUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, userUnitId]);

  // Keep a ref to the latest loadAnalytics so the mount-only effect
  // always calls the version that matches the current filter values.
  const loadAnalyticsRef = useRef(loadAnalytics);

  useEffect(() => {
    loadAnalyticsRef.current = loadAnalytics;
  }, [loadAnalytics]);

  // Load data once on mount. Filter changes do NOT trigger a reload;
  // the user must click the Refresh button to re-fetch.
  useEffect(() => {
    loadAnalyticsRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------------------------------------------------------------
     RENDER
  -------------------------------------------------------------------------- */

  return (
    <div className="min-h-full space-y-6 pb-8">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-4 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              Analytics by Personnel
            </h1>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              Monitor patrol activity, personnel performance, and operational
              mileage.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadAnalytics}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* FILTER PANEL */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">
              Analytics Filters
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              Refine results by personnel, activity, unit, and date.
            </p>
          </div>
        </div>

        <div
          className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${filterGridCols}`}
        >
          {/* SEARCH */}
          <div className="xl:col-span-1">
            <label className="mb-1.5 block font-semibold text-slate-600 dark:text-slate-300">
              Search Personnel
            </label>
            <input
              type="text"
              placeholder="Badge, name, rank..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* PATROL TYPE */}
          <div>
            <label className="mb-1.5 block font-semibold text-slate-600 dark:text-slate-300">
              Patrol Activity
            </label>
            <select
              value={selectedPatrolType}
              onChange={(e) => setSelectedPatrolType(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">All Activities</option>
              {patrolTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {isAdminSafe && (
            <div>
              <label className="mb-1.5 block font-semibold text-slate-600 dark:text-slate-300">
                Unit/Station
              </label>
              <select
                value={selectedUnit ?? ""}
                onChange={(e) => setSelectedUnit(e.target.value || null)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">All Units/Stations</option>
                {visibleUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unit_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* DATE FROM */}
          <div>
            <label className="mb-1.5 block font-semibold text-slate-600 dark:text-slate-300">
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* DATE TO */}
          <div>
            <label className="mb-1.5 block font-semibold text-slate-600 dark:text-slate-300">
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
            <p className="text-slate-500 dark:text-slate-400">
              Loading personnel analytics...
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-500 dark:text-slate-400">
                    Total Personnel
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {summary.total_personnel.toLocaleString()}
                  </p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <BarChart3 className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-500 dark:text-slate-400">
                    Total Patrol Hours
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {summary.total_patrol_hours}
                  </p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                  <Clock className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-500 dark:text-slate-400">
                    Total Man-Hours
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {summary.total_man_hours.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <Check className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-500 dark:text-slate-400">
                    Kilometers Patrolled
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {summary.total_kilometers.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                  <Route className="h-6 w-6" />
                </div>
              </div>
            </div>
          </div>

          {/* PATROL TREND CHART */}
          {(dailyTrend.length > 0 || hourlyTrend.length > 0) && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Patrol Activity Trend
                  </h2>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    Compare patrol sessions, duration, manpower, and distance.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={trendMetric}
                    onChange={(e) =>
                      setTrendMetric(
                        e.target.value as
                          | "sessions"
                          | "patrolHours"
                          | "manHours"
                          | "kilometers",
                      )
                    }
                    className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="sessions">Patrol Sessions</option>
                    <option value="patrolHours">Patrol Hours</option>
                    <option value="manHours">Man-Hours</option>
                    <option value="kilometers">Kilometers Patrolled</option>
                  </select>

                  <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setTrendType("hourly")}
                      className={`rounded-lg px-4 py-1.5 font-semibold transition ${
                        trendType === "hourly"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                      }`}
                    >
                      Hourly
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrendType("daily")}
                      className={`rounded-lg px-4 py-1.5 font-semibold transition ${
                        trendType === "daily"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                      }`}
                    >
                      Daily
                    </button>
                  </div>
                </div>
              </div>

              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendType === "daily" ? dailyTrend : hourlyTrend}
                    margin={{ top: 18, right: 16, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={theme === "dark" ? "#334155" : "#e2e8f0"}
                      vertical={false}
                    />
                    <XAxis
                      dataKey={trendType === "daily" ? "date" : "hour"}
                      tick={{
                        fill: theme === "dark" ? "#cbd5e1" : "#64748b",
                        fontSize: 12,
                      }}
                      tickLine={false}
                      axisLine={{
                        stroke: theme === "dark" ? "#475569" : "#cbd5e1",
                      }}
                      minTickGap={18}
                    />
                    <YAxis
                      tick={{
                        fill: theme === "dark" ? "#cbd5e1" : "#64748b",
                        fontSize: 12,
                      }}
                      tickLine={false}
                      axisLine={false}
                      width={75}
                      tickFormatter={(value) =>
                        trendMetric === "kilometers"
                          ? `${value} km`
                          : trendMetric === "sessions"
                            ? String(value)
                            : `${value} h`
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor:
                          theme === "dark" ? "#0f172a" : "#ffffff",
                        borderColor: theme === "dark" ? "#334155" : "#e2e8f0",
                        borderRadius: "12px",
                        color: theme === "dark" ? "#f8fafc" : "#0f172a",
                      }}
                      formatter={(value) => {
                        const numericValue = Number(value ?? 0);

                        switch (trendMetric) {
                          case "sessions":
                            return [
                              numericValue.toLocaleString(),
                              "Patrol Sessions",
                            ];

                          case "patrolHours":
                            return [
                              `${numericValue.toFixed(2)} hrs`,
                              "Patrol Hours",
                            ];

                          case "manHours":
                            return [
                              `${numericValue.toFixed(2)} hrs`,
                              "Man-Hours",
                            ];

                          case "kilometers":
                            return [
                              `${numericValue.toFixed(2)} km`,
                              "Kilometers",
                            ];

                          default:
                            return [numericValue.toLocaleString(), ""];
                        }
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey={trendMetric}
                      name={
                        trendMetric === "sessions"
                          ? "Patrol Sessions"
                          : trendMetric === "patrolHours"
                            ? "Patrol Hours"
                            : trendMetric === "manHours"
                              ? "Man-Hours"
                              : "Kilometers Patrolled"
                      }
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ r: 3, fill: "#2563eb", strokeWidth: 0 }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* PERSONNEL TABLE */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white">
                    Personnel Performance
                  </h2>
                  <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                    Individual patrol duration and GPS distance.
                  </p>
                </div>
              </div>

              <span className="inline-flex w-fit items-center rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {filteredPersonnel.length.toLocaleString()} personnel
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/70">
                  <tr>
                    <th className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                      #
                    </th>
                    <th
                      className="px-5 py-3.5 text-slate-500 dark:text-slate-400 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      onClick={() => handleSort("badge_number")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Badge Number
                        {getSortIcon("badge_number")}
                      </div>
                    </th>
                    <th
                      className="px-5 py-3.5 text-slate-500 dark:text-slate-400 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      onClick={() => handleSort("fullname")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Rank / Name
                        {getSortIcon("fullname")}
                      </div>
                    </th>
                    <th
                      className="px-5 py-3.5 text-center text-slate-500 dark:text-slate-400 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      onClick={() => handleSort("patrol_hours")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Patrol Hours
                        {getSortIcon("patrol_hours")}
                      </div>
                    </th>
                    <th
                      className="px-5 py-3.5 text-center text-slate-500 dark:text-slate-400 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      onClick={() => handleSort("kilometer_patrolled")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Kilometers
                        {getSortIcon("kilometer_patrolled")}
                      </div>
                    </th>
                    <th className="px-5 py-3.5 text-right text-slate-500 dark:text-slate-400">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPersonnel.length > 0 ? (
                    filteredPersonnel.map((person, index) => (
                      <tr
                        key={person.id ?? index}
                        className="transition-colors hover:bg-blue-50/60 dark:hover:bg-slate-800/60"
                      >
                        <td className="px-5 py-4 text-slate-400 dark:text-slate-500">
                          {index + 1}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 font-mono font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {person.badge_number || "N/A"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {person.rank?.rank_name} {person.fullname}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-center font-medium tabular-nums text-slate-700 dark:text-slate-200">
                          {person.patrol_hours || "00:00:00"}
                        </td>
                        <td className="px-5 py-4 text-center font-semibold tabular-nums text-slate-900 dark:text-white">
                          {Number(
                            person.kilometer_patrolled || 0,
                          ).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          <span className="font-normal text-slate-500 dark:text-slate-400">
                            km
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link
                            to={`/analytics-per-personnel/${person.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                          >
                            View Details
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-14 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center">
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                            <FileText className="h-6 w-6" />
                          </div>
                          <p className="font-semibold text-slate-700 dark:text-slate-200">
                            No personnel found
                          </p>
                          <p className="mt-1 text-slate-500 dark:text-slate-400">
                            Try changing the search term, patrol activity, or
                            date range.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
