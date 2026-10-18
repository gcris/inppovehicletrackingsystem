import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";
import { useTheme } from "../../components/ThemeProvider";
import {
  BarChart3,
  RefreshCcw,
  Search,
  Users,
  Clock3,
  Route,
  Gauge,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Unit = {
  id: string;
  unit_name: string;
  level?: number;
  classification?: number | null;
};

type StationAnalytics = {
  unit_id: string;
  unit_name: string;
  personnel_deployed: number;
  patrol_minutes: number;
  man_minutes: number;
  kilometers: number;
  sessions: number;
};

type TrendPoint = {
  date: string;
  sessions: number;
  patrolHours: number;
  manHours: number;
  kilometers: number;
};

type PatrolLogRow = {
  id: string;
  personnel_id: string | null;
  vehicle_id: string | null;
  captured_at: string;
  duty_type: string | null;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  personnel?: {
    id: string;
    unit_id: string | null;
    fullname?: string | null;
    badge_number?: string | null;
    unit?: {
      id: string;
      unit_name: string;
    } | null;
    rank?: {
      rank_name?: string | null;
    } | null;
  } | null;
  mobility_assets?: {
    id?: string;
    plate_number?: string | null;
    unit_id?: string | null;
  } | null;
};

type PersonAccumulator = {
  personnelId: string;
  unitId: string;
  unitName: string;
  logs: PatrolLogRow[];
};

const EXCLUDED_DUTY_TYPES = [
  "EMERGENCY_SOS",
  "Intel-Driven Operation",
  "Special Laws",
];

const PAGE_SIZE = 1000;
const MAX_LOGS = 10000;
const MANILA_OFFSET = "+08:00";

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toNumber(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function getCoordinates(log: PatrolLogRow): {
  latitude: number;
  longitude: number;
} | null {
  const latitude = toNumber(log.latitude ?? log.lat);
  const longitude = toNumber(log.longitude ?? log.lng);

  if (
    !latitude ||
    !longitude ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

function calculateDistance(logs: PatrolLogRow[]): number {
  if (logs.length < 2) return 0;

  const sorted = [...logs].sort(
    (a, b) =>
      new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime(),
  );

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  let totalKm = 0;

  for (let i = 1; i < sorted.length; i++) {
    const previous = getCoordinates(sorted[i - 1]);
    const current = getCoordinates(sorted[i]);

    if (!previous || !current) continue;

    const lat1 = toRadians(previous.latitude);
    const lat2 = toRadians(current.latitude);
    const deltaLat = toRadians(current.latitude - previous.latitude);
    const deltaLng = toRadians(current.longitude - previous.longitude);

    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

    const distance =
      2 *
      earthRadiusKm *
      Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));

    // Ignore tiny GPS fluctuations.
    if (distance > 0.005) {
      totalKm += distance;
    }
  }

  return totalKm;
}

function formatHoursMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return `${hours.toLocaleString()}:${String(remainder).padStart(2, "0")}`;
}

function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function getSessionData(logs: PatrolLogRow[]) {
  const sorted = [...logs].sort(
    (a, b) =>
      new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime(),
  );

  const sessions: Array<{
    date: string;
    durationMinutes: number;
    kilometers: number;
    logs: PatrolLogRow[];
  }> = [];

  let currentSession: PatrolLogRow[] = [];

  const flushSession = () => {
    if (!currentSession.length) return;

    const first = currentSession[0];
    const last = currentSession[currentSession.length - 1];
    const start = new Date(first.captured_at).getTime();
    const end = new Date(last.captured_at).getTime();

    sessions.push({
      date: first.captured_at.slice(0, 10),
      // Avoid treating isolated or malformed timestamps as patrol hours.
      durationMinutes:
        currentSession.length > 1 && end >= start ? (end - start) / 60000 : 0,
      kilometers: calculateDistance(currentSession),
      logs: currentSession,
    });

    currentSession = [];
  };

  for (const log of sorted) {
    if (!Number.isFinite(new Date(log.captured_at).getTime())) continue;

    if (currentSession.length) {
      const previous = currentSession[currentSession.length - 1];
      const gapMinutes =
        (new Date(log.captured_at).getTime() -
          new Date(previous.captured_at).getTime()) /
        60000;

      // A gap greater than 10 minutes starts a new patrol session.
      if (gapMinutes > 10 || gapMinutes < 0) {
        flushSession();
      }
    }

    currentSession.push(log);
  }

  flushSession();
  return sessions;
}

const AnalyticsByStationPage: React.FC = () => {
  const { unitId, isAdmin } = useAuth();
  const theme = useTheme();
  const isDark = theme === "dark";

  const [loading, setLoading] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const [dateFrom, setDateFrom] = useState(getLocalDateString());
  const [dateTo, setDateTo] = useState(getLocalDateString());

  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedPatrolType, setSelectedPatrolType] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [stationData, setStationData] = useState<StationAnalytics[]>([]);
  const [dailyTrend, setDailyTrend] = useState<TrendPoint[]>([]);
  const [trendType, setTrendType] = useState<"daily" | "hourly">("daily");
  const [trendMetric, setTrendMetric] = useState<
    "sessions" | "patrolHours" | "manHours" | "kilometers"
  >("sessions");

  const [errorMessage, setErrorMessage] = useState("");

  /*
   * Non-admin users are always scoped to their assigned unit.
   * An empty unitId for a non-admin fails closed; it never means "all units".
   */
  const effectiveUnitId = isAdmin ? selectedUnit || null : unitId || null;

  useEffect(() => {
    let active = true;

    const loadUnits = async () => {
      const { data, error } = await supabase
        .from("unit")
        .select("id, unit_name, level, classification")
        .order("unit_name", { ascending: true });

      if (!active) return;

      if (error) {
        console.error("Failed to load units:", error);
        setUnits([]);
        return;
      }

      setUnits((data ?? []) as Unit[]);
    };

    void loadUnits();

    return () => {
      active = false;
    };
  }, []);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      if (!dateFrom || !dateTo) {
        setStationData([]);
        setDailyTrend([]);
        return;
      }

      if (dateFrom > dateTo) {
        setErrorMessage("The start date must be on or before the end date.");
        setStationData([]);
        setDailyTrend([]);
        return;
      }

      // Fail closed for non-admin accounts that have no assigned unit.
      if (!isAdmin && !unitId) {
        setStationData([]);
        setDailyTrend([]);
        return;
      }

      let allLogs: PatrolLogRow[] = [];

      for (let offset = 0; offset < MAX_LOGS; offset += PAGE_SIZE) {
        let query = supabase
          .from("patrol_logs")
          .select(
            `
              id,
              personnel_id,
              vehicle_id,
              captured_at,
              duty_type,
              latitude,
              longitude,
              personnel:personnel_id!inner (
                id,
                unit_id,
                fullname,
                badge_number,
                unit:unit_id (
                  id,
                  unit_name
                ),
                rank:rank_id (
                  rank_name
                )
              ),
              mobility_assets:vehicle_id (
                id,
                plate_number,
                unit_id
              )
            `,
          )
          .gte("captured_at", `${dateFrom}T00:00:00${MANILA_OFFSET}`)
          .lte("captured_at", `${dateTo}T23:59:59.999${MANILA_OFFSET}`)
          .not(
            "duty_type",
            "in",
            `(${EXCLUDED_DUTY_TYPES.map((type) => `"${type}"`).join(",")})`,
          )
          .order("captured_at", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);

        if (effectiveUnitId) {
          query = query.eq("personnel.unit_id", effectiveUnitId);
        }

        if (selectedPatrolType) {
          query = query.eq("duty_type", selectedPatrolType);
        }

        const { data, error } = await query;

        if (error) {
          console.error("Failed to load patrol logs:", error);
          throw new Error(error.message);
        }

        const page = (data ?? []) as unknown as PatrolLogRow[];
        allLogs = allLogs.concat(page);

        if (page.length < PAGE_SIZE) break;
      }

      /*
       * Group the actual logs by personnel, then aggregate each person's
       * sessions and distance into their assigned station.
       *
       * This avoids summing already-aggregated personnel totals and
       * inflating station totals.
       */
      const personnelGroups = new Map<string, PersonAccumulator>();

      for (const log of allLogs) {
        const person = log.personnel;
        const personId = log.personnel_id || person?.id;
        const personUnitId = person?.unit_id;

        // Do not assign a log to an unknown station.
        if (!personId || !personUnitId) continue;

        // Apply the effective scope again locally as a safeguard.
        if (effectiveUnitId && personUnitId !== effectiveUnitId) continue;

        const unitName =
          person?.unit?.unit_name ||
          units.find((unit) => unit.id === personUnitId)?.unit_name ||
          "Unknown Station";

        const existing = personnelGroups.get(personId);

        if (existing) {
          existing.logs.push(log);
        } else {
          personnelGroups.set(personId, {
            personnelId: personId,
            unitId: personUnitId,
            unitName,
            logs: [log],
          });
        }
      }

      const stationMap = new Map<string, StationAnalytics>();
      const trendMap = new Map<string, TrendPoint>();

      for (const person of personnelGroups.values()) {
        let station = stationMap.get(person.unitId);

        if (!station) {
          station = {
            unit_id: person.unitId,
            unit_name: person.unitName,
            personnel_deployed: 0,
            patrol_minutes: 0,
            man_minutes: 0,
            kilometers: 0,
            sessions: 0,
          };
          stationMap.set(person.unitId, station);
        }

        // A person is counted once per station in the selected date range.
        station.personnel_deployed += 1;

        const sessions = getSessionData(person.logs);

        for (const session of sessions) {
          station.sessions += 1;
          station.patrol_minutes += session.durationMinutes;
          station.man_minutes += session.durationMinutes;
          station.kilometers += session.kilometers;

          const key = session.date;
          let point = trendMap.get(key);

          if (!point) {
            point = {
              date: key,
              sessions: 0,
              patrolHours: 0,
              manHours: 0,
              kilometers: 0,
            };
            trendMap.set(key, point);
          }

          point.sessions += 1;
          point.patrolHours += session.durationMinutes / 60;
          point.manHours += session.durationMinutes / 60;
          point.kilometers += session.kilometers;
        }
      }

      const nextStations = Array.from(stationMap.values()).sort((a, b) =>
        a.unit_name.localeCompare(b.unit_name),
      );

      const nextTrend = Array.from(trendMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date),
      );

      if (trendType === "hourly") {
        /*
         * Hourly values are based on the timestamp hour in the browser's
         * local timezone. Daily mode remains the default.
         */
        const hourlyMap = new Map<string, TrendPoint>();

        for (const person of personnelGroups.values()) {
          for (const session of getSessionData(person.logs)) {
            const firstLog = session.logs[0];
            const hour = new Date(firstLog.captured_at).getHours();
            const key = `${String(hour).padStart(2, "0")}:00`;

            let point = hourlyMap.get(key);

            if (!point) {
              point = {
                date: key,
                sessions: 0,
                patrolHours: 0,
                manHours: 0,
                kilometers: 0,
              };
              hourlyMap.set(key, point);
            }

            point.sessions += 1;
            point.patrolHours += session.durationMinutes / 60;
            point.manHours += session.durationMinutes / 60;
            point.kilometers += session.kilometers;
          }
        }

        const hourlyPoints = Array.from(hourlyMap.values()).sort((a, b) =>
          a.date.localeCompare(b.date),
        );

        setStationData(nextStations);
        setDailyTrend(hourlyPoints);
      } else {
        setStationData(nextStations);
        setDailyTrend(nextTrend);
      }
    } catch (error) {
      console.error("Analytics loading failed:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load station analytics.",
      );
      setStationData([]);
      setDailyTrend([]);
    } finally {
      setLoading(false);
    }
  }, [
    dateFrom,
    dateTo,
    effectiveUnitId,
    isAdmin,
    unitId,
    selectedPatrolType,
    trendType,
    units,
  ]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      await loadAnalytics();
    };

    void run();

    return () => {
      active = false;
    };
  }, [loadAnalytics, refreshCounter]);

  const filteredStations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) return stationData;

    return stationData.filter((station) =>
      station.unit_name.toLowerCase().includes(term),
    );
  }, [stationData, searchTerm]);

  const summary = useMemo(() => {
    return filteredStations.reduce(
      (result, station) => {
        result.totalPersonnel += station.personnel_deployed;
        result.totalPatrolMinutes += station.patrol_minutes;
        result.totalManMinutes += station.man_minutes;
        result.totalKilometers += station.kilometers;
        result.totalSessions += station.sessions;
        return result;
      },
      {
        totalPersonnel: 0,
        totalPatrolMinutes: 0,
        totalManMinutes: 0,
        totalKilometers: 0,
        totalSessions: 0,
      },
    );
  }, [filteredStations]);

  const chartMetric = {
    sessions: { label: "Patrol Sessions" },
    patrolHours: { label: "Patrol Hours" },
    manHours: { label: "Man-Hours" },
    kilometers: { label: "Kilometers" },
  }[trendMetric];

  const formatDuration = (totalMinutes: number) => {
    const totalSeconds = Math.round(totalMinutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  };

  const stationChartData = useMemo(
    () =>
      filteredStations.map((station) => ({
        stationName: station.unit_name,
        value:
          trendMetric === "sessions"
            ? station.sessions
            : trendMetric === "patrolHours"
              ? station.patrol_minutes / 60
              : trendMetric === "manHours"
                ? station.man_minutes / 60
                : station.kilometers,
        duration:
          trendMetric === "patrolHours"
            ? formatDuration(station.patrol_minutes)
            : trendMetric === "manHours"
              ? formatDuration(station.man_minutes)
              : null,
      })),
    [filteredStations, trendMetric],
  );

  const cardClass = isDark
    ? "border border-slate-700 bg-slate-900 text-slate-100"
    : "border border-slate-200 bg-white text-slate-900";

  const mutedTextClass = isDark ? "text-slate-400" : "text-slate-500";

  const inputClass = isDark
    ? "border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500"
    : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400";

  const tableHeaderClass = isDark
    ? "bg-slate-800 text-slate-300"
    : "bg-slate-100 text-slate-600";

  const tableRowClass = isDark
    ? "border-slate-700 hover:bg-slate-800/70"
    : "border-slate-200 hover:bg-slate-50";

  return (
    <div className="min-h-full space-y-6 pb-8">
      {/* Page heading */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Station Performance Analytics
          </h1>
          <p className={`mt-1 ${mutedTextClass}`}>
            Patrol activity and deployment performance by station/unit
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRefreshCounter((value) => value + 1)}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <section className={`rounded-xl p-4 shadow-sm ${cardClass}`}>
        <div className="mb-4 flex items-center gap-2">
          <Search size={18} className="text-blue-500" />
          <h2 className="font-semibold">Filters</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className={`mb-1.5 block font-medium ${mutedTextClass}`}>
              Search station
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Station name..."
              className={`w-full rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${inputClass}`}
            />
          </div>

          <div>
            <label className={`mb-1.5 block font-medium ${mutedTextClass}`}>
              Station / Unit
            </label>
            <select
              value={isAdmin ? selectedUnit : unitId || ""}
              onChange={(event) => setSelectedUnit(event.target.value)}
              disabled={!isAdmin}
              className={`w-full rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-70 ${inputClass}`}
            >
              {isAdmin && <option value="">All Stations</option>}
              {!isAdmin && (
                <option value={unitId || ""}>
                  {units.find((unit) => unit.id === unitId)?.unit_name ||
                    "Assigned Station"}
                </option>
              )}
              {units
                .filter((unit) => isAdmin || unit.id === unitId)
                .map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unit_name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className={`mb-1.5 block font-medium ${mutedTextClass}`}>
              Patrol Type
            </label>
            <select
              value={selectedPatrolType}
              onChange={(event) => setSelectedPatrolType(event.target.value)}
              className={`w-full rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500 ${inputClass}`}
            >
              <option value="">All Patrol Types</option>
              <option value="Mobile">Mobile</option>
              <option value="TMRU">TMRU</option>
              <option value="Foot">Foot</option>
              <option value="Bike">Bike</option>
              <option value="Seaborne">Seaborne</option>
              <option value="Checkpoint">Checkpoint</option>
              <option value="Simulation">Simulation</option>
              <option value="Special Event">Special Event</option>
            </select>
          </div>

          <div>
            <label className={`mb-1.5 block font-medium ${mutedTextClass}`}>
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => setDateFrom(event.target.value)}
              className={`w-full rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500 ${inputClass}`}
            />
          </div>

          <div>
            <label className={`mb-1.5 block font-medium ${mutedTextClass}`}>
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => setDateTo(event.target.value)}
              className={`w-full rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500 ${inputClass}`}
            />
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <strong>Unable to load analytics:</strong> {errorMessage}
        </div>
      )}

      {/* Summary cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`rounded-xl p-5 shadow-sm ${cardClass}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium ${mutedTextClass}`}>
                Personnel Deployed
              </p>
              <p className="mt-2 text-3xl font-bold">
                {loading ? "—" : summary.totalPersonnel.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <Users size={24} />
            </div>
          </div>
        </div>

        <div className={`rounded-xl p-5 shadow-sm ${cardClass}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium ${mutedTextClass}`}>
                Total Patrol Hours
              </p>
              <p className="mt-2 text-3xl font-bold">
                {loading ? "—" : formatHoursMinutes(summary.totalPatrolMinutes)}
              </p>
            </div>
            <div className="rounded-xl bg-amber-100 p-3 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <Clock3 size={24} />
            </div>
          </div>
        </div>

        <div className={`rounded-xl p-5 shadow-sm ${cardClass}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium ${mutedTextClass}`}>Total Man-Hours</p>
              <p className="mt-2 text-3xl font-bold">
                {loading ? "—" : formatHoursMinutes(summary.totalManMinutes)}
              </p>
            </div>
            <div className="rounded-xl bg-amber-100 p-3 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <Clock3 size={24} />
            </div>
          </div>
        </div>

        <div className={`rounded-xl p-5 shadow-sm ${cardClass}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium ${mutedTextClass}`}>
                Total Kilometers
              </p>
              <p className="mt-2 text-3xl font-bold">
                {loading ? "—" : formatNumber(summary.totalKilometers)}
              </p>
            </div>
            <div className="rounded-xl bg-purple-100 p-3 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
              <Route size={24} />
            </div>
          </div>
        </div>
      </section>

      {/* Patrol Activity Bar Chart by Station */}
      {(dailyTrend.length > 0 || stationChartData.length > 0) && (
        <section className={`rounded-2xl p-5 shadow-sm ${cardClass}`}>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Patrol Activity by Station
              </h2>
              <p className={`mt-1 ${mutedTextClass}`}>
                Compare patrol performance across stations for the selected
                reporting period.
              </p>
            </div>

            <div className="w-full sm:w-52">
              <label className={`mb-1.5 block font-medium ${mutedTextClass}`}>
                Performance Metric
              </label>

              <select
                value={trendMetric}
                onChange={(event) =>
                  setTrendMetric(
                    event.target.value as
                      | "sessions"
                      | "patrolHours"
                      | "manHours"
                      | "kilometers",
                  )
                }
                className={`w-full rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500 ${inputClass}`}
              >
                <option value="sessions">Patrol Sessions</option>
                <option value="patrolHours">Patrol Hours</option>
                <option value="manHours">Man-Hours</option>
                <option value="kilometers">Kilometers</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div
              className={`flex h-[360px] items-center justify-center ${mutedTextClass}`}
            >
              Loading station chart...
            </div>
          ) : stationChartData.length === 0 ? (
            <div
              className={`flex h-[360px] items-center justify-center ${mutedTextClass}`}
            >
              No patrol activity found for the selected filters.
            </div>
          ) : (
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stationChartData}
                  margin={{ top: 12, right: 20, left: 8, bottom: 75 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={isDark ? "#334155" : "#e2e8f0"}
                  />

                  <XAxis
                    dataKey="stationName"
                    tick={{
                      fontSize: 11,
                      fill: isDark ? "#cbd5e1" : "#475569",
                    }}
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={95}
                    axisLine={{ stroke: isDark ? "#475569" : "#cbd5e1" }}
                    tickLine={false}
                  />

                  <YAxis
                    allowDecimals={trendMetric !== "sessions"}
                    tick={{
                      fontSize: 11,
                      fill: isDark ? "#cbd5e1" : "#475569",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === "dark" ? "#0F172A" : "#FFFFFF",
                      border: `1px solid ${theme === "dark" ? "#334155" : "#E2E8F0"}`,
                      borderRadius: "8px",
                      color: theme === "dark" ? "#F8FAFC" : "#0F172A",
                    }}
                    labelStyle={{
                      color: theme === "dark" ? "#F8FAFC" : "#0F172A",
                      fontWeight: 600,
                    }}
                    itemStyle={{
                      color: theme === "dark" ? "#E2E8F0" : "#334155",
                    }}
                    formatter={(value, _name, item) => {
                      if (
                        (trendMetric === "patrolHours" ||
                          trendMetric === "manHours") &&
                        item.payload.duration
                      ) {
                        return [
                          item.payload.duration,
                          trendMetric === "patrolHours"
                            ? "Patrol Duration"
                            : "Man-Hours",
                        ];
                      }

                      return [Number(value ?? 0).toLocaleString(), "Total"];
                    }}
                  />

                  <Legend />

                  <Bar
                    dataKey="value"
                    name={chartMetric.label}
                    fill="#2563eb"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={55}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      )}

      {/* Station table */}
      <section className={`overflow-hidden rounded-xl shadow-sm ${cardClass}`}>
        <div className="flex flex-col gap-2 border-b border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              Station Performance Summary
            </h2>
            <p className={`mt-1 ${mutedTextClass}`}>
              One row per station/unit for the selected reporting period
            </p>
          </div>
          <div className={`${mutedTextClass}`}>
            {loading ? "Loading..." : `${filteredStations.length} station(s)`}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className={tableHeaderClass}>
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Station / Unit</th>
                <th className="px-4 py-3 text-center font-semibold">
                  Personnel Deployed
                </th>
                <th className="px-4 py-3 text-center font-semibold">
                  Patrol Sessions
                </th>
                <th className="px-4 py-3 text-center font-semibold">
                  Patrol Hours
                </th>
                <th className="px-4 py-3 text-center font-semibold">
                  Man-Hours
                </th>
                <th className="px-4 py-3 text-center font-semibold">
                  Kilometers
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className={`px-4 py-12 text-center ${mutedTextClass}`}
                  >
                    Loading station analytics...
                  </td>
                </tr>
              ) : filteredStations.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className={`px-4 py-12 text-center ${mutedTextClass}`}
                  >
                    No station analytics found for the selected filters.
                  </td>
                </tr>
              ) : (
                filteredStations.map((station, index) => (
                  <tr
                    key={station.unit_id}
                    className={`border-t ${tableRowClass}`}
                  >
                    <td className={`px-4 py-3 ${mutedTextClass}`}>
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {station.unit_name}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {station.personnel_deployed.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {station.sessions.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {formatHoursMinutes(station.patrol_minutes)}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {formatHoursMinutes(station.man_minutes)}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold tabular-nums">
                      {formatNumber(station.kilometers)} km
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {!loading && filteredStations.length > 0 && (
              <tfoot
                className={
                  isDark
                    ? "bg-slate-800 font-semibold"
                    : "bg-slate-50 font-semibold"
                }
              >
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-4 py-3" colSpan={2}>
                    TOTAL
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {summary.totalPersonnel.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {summary.totalSessions.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {formatHoursMinutes(summary.totalPatrolMinutes)}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {formatHoursMinutes(summary.totalManMinutes)}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {formatNumber(summary.totalKilometers)} km
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
};

export default AnalyticsByStationPage;
