import React, { useState, useEffect } from "react";
import { supabase, type PatrolLog, type Personnel } from "../../lib/supabase";
import { useParams } from "react-router-dom";
import {
  Activity,
  CalendarDays,
  Clock3,
  FileText,
  MapPin,
  Phone,
  MessageCircle,
  RefreshCcw,
  Route,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type DutyTypeStat = {
  duty_type: string;
  patrol_minutes: number;
  kilometer_patrolled: number;
  duration_hours: number;
};

const SPECIAL_DUTY_TYPES = ["Intel-Driven Operation", "Special Laws"];

const getLocalDateString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDuration = (totalSeconds: number) => {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
};

const formatMinutes = (minutes: number) => formatDuration(minutes * 60);

export default function AnalyticsPerPersonnelPage() {
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [personnelData, setPersonnelData] = useState<Personnel | null>(null);

  const [dateFrom, setDateFrom] = useState(getLocalDateString);
  const [dateTo, setDateTo] = useState(getLocalDateString);

  const [dutyTypeStats, setDutyTypeStats] = useState<DutyTypeStat[]>([]);

  useEffect(() => {
    if (id) {
      void loadPersonnelAnalytics();
    } else {
      setLoading(false);
      setErrorMessage("No personnel ID was provided.");
    }
    // Load initially when the personnel ID changes.
    // Date filters are applied when Refresh is clicked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadPersonnelAnalytics = async () => {
    if (!id) return;

    if (dateFrom && dateTo && dateFrom > dateTo) {
      setErrorMessage("The start date must not be after the end date.");
      return;
    }

    if (hasLoaded) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage("");

    try {
      const { data: personnel, error: personnelError } = await supabase
        .from("personnel")
        .select(
          `
              *,
              unit:unit!personnel_unit_id_fkey(*),
              rank(*)
            `,
        )
        .eq("id", id)
        .single();

      if (personnelError) throw personnelError;

      setPersonnelData(personnel as Personnel);

      let page = 0;
      let hasMore = true;
      const allLogs: PatrolLog[] = [];

      while (hasMore) {
        let query = supabase
          .from("patrol_logs")
          .select(
            `
              *,
              personnel:personnel_id(
                *,
                unit(*),
                rank(*)
              ),
              mobility_assets:vehicle_id(*)
            `,
          )
          .eq("personnel_id", id)
          .order("captured_at", { ascending: true })
          .range(page * 1000, page * 1000 + 999);

        if (dateFrom) {
          query = query.gte("captured_at", `${dateFrom}T00:00:00+08:00`);
        }

        if (dateTo) {
          query = query.lte("captured_at", `${dateTo}T23:59:59.999+08:00`);
        }

        query = query.neq("duty_type", "EMERGENCY_SOS");

        const { data, error } = await query;

        if (error) throw error;

        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }

        allLogs.push(...(data as PatrolLog[]));

        if (data.length < 1000) {
          hasMore = false;
        } else {
          page++;
        }
      }

      setDutyTypeStats(calculateStatisticsByDutyType(allLogs));
      setHasLoaded(true);
    } catch (error) {
      console.error("Error loading personnel analytics:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load personnel analytics.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateStatisticsByDutyType = (logs: PatrolLog[]): DutyTypeStat[] => {
    const grouped: Record<string, PatrolLog[]> = {};

    logs.forEach((log) => {
      const dutyType = log.duty_type || "Unknown";

      if (!grouped[dutyType]) {
        grouped[dutyType] = [];
      }

      grouped[dutyType].push(log);
    });

    return Object.entries(grouped)
      .map(([dutyType, dutyLogs]) => {
        if (SPECIAL_DUTY_TYPES.includes(dutyType)) {
          return {
            duty_type: dutyType,
            patrol_minutes: 0,
            kilometer_patrolled: 0,
            duration_hours: calculateDurationFromLogs(dutyLogs),
          };
        }

        const { patrolMinutes, totalKilometers } =
          calculatePatrolHoursAndDistance(dutyLogs);

        return {
          duty_type: dutyType,
          patrol_minutes: patrolMinutes,
          kilometer_patrolled: Number(totalKilometers.toFixed(2)),
          duration_hours: 0,
        };
      })
      .sort((a, b) => a.duty_type.localeCompare(b.duty_type));
  };

  const calculatePatrolHoursAndDistance = (logs: PatrolLog[]) => {
    if (logs.length < 2) {
      return { patrolMinutes: 0, totalKilometers: 0 };
    }

    const sortedLogs = [...logs].sort(
      (a, b) =>
        new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime(),
    );

    let totalMinutes = 0;

    for (let i = 0; i < sortedLogs.length - 1; i++) {
      const current = new Date(sortedLogs[i].captured_at).getTime();

      const next = new Date(sortedLogs[i + 1].captured_at).getTime();

      const gapMinutes = (next - current) / 60000;

      // Exclude intervals longer than 30 minutes.
      if (gapMinutes > 0 && gapMinutes <= 30) {
        totalMinutes += gapMinutes;
      }
    }

    return {
      patrolMinutes: totalMinutes,
      totalKilometers: calculateDistance(sortedLogs),
    };
  };

  const calculateDistance = (logs: PatrolLog[]) => {
    if (logs.length < 2) return 0;

    const EARTH_RADIUS = 6371;
    const toRadians = (deg: number) => deg * (Math.PI / 180);

    let distance = 0;

    for (let i = 0; i < logs.length - 1; i++) {
      const start = logs[i];
      const end = logs[i + 1];

      if (
        start.latitude == null ||
        start.longitude == null ||
        end.latitude == null ||
        end.longitude == null
      ) {
        continue;
      }

      const gapMinutes =
        (new Date(end.captured_at).getTime() -
          new Date(start.captured_at).getTime()) /
        60000;

      // Avoid connecting distant points across long recording gaps.
      if (gapMinutes <= 0 || gapMinutes > 30) continue;

      const dLat = toRadians(end.latitude - start.latitude);
      const dLon = toRadians(end.longitude - start.longitude);

      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(start.latitude)) *
          Math.cos(toRadians(end.latitude)) *
          Math.sin(dLon / 2) ** 2;

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      const segmentDistance = EARTH_RADIUS * c;

      // Ignore GPS jitter below 5 meters.
      if (segmentDistance > 0.005) {
        distance += segmentDistance;
      }
    }

    return distance;
  };

  const calculateDurationFromLogs = (logs: PatrolLog[]) => {
    if (logs.length < 2) return 0;

    const sortedLogs = [...logs].sort(
      (a, b) =>
        new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime(),
    );

    const start = new Date(sortedLogs[0].captured_at).getTime();

    const end = new Date(
      sortedLogs[sortedLogs.length - 1].captured_at,
    ).getTime();

    return Math.max(0, (end - start) / 3600000);
  };

  const totalPatrolMinutes = dutyTypeStats.reduce(
    (sum, item) =>
      SPECIAL_DUTY_TYPES.includes(item.duty_type)
        ? sum
        : sum + item.patrol_minutes,
    0,
  );

  const totalKilometers = dutyTypeStats.reduce(
    (sum, item) => sum + item.kilometer_patrolled,
    0,
  );

  const totalSpecialDutyHours = dutyTypeStats.reduce(
    (sum, item) => sum + item.duration_hours,
    0,
  );

  const totalActivities = dutyTypeStats.length;

  const isSpecialDuty = (dutyType: string) =>
    SPECIAL_DUTY_TYPES.includes(dutyType);

  const cardClass =
    "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm " +
    "dark:border-slate-800 dark:bg-slate-900";

  const mutedText = "text-slate-500 dark:text-slate-400";

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
        <p className={mutedText}>Loading personnel analytics...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Page header */}
      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-blue-100 p-3 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            <FileText className="h-7 w-7" />
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Personnel Analytics
            </h1>
            <p className={`mt-1 ${mutedText}`}>
              Individual patrol activity, duration, and distance report.
            </p>
          </div>
        </div>

        {/* Date filters */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <label
              htmlFor="date-from"
              className="text-slate-500 dark:text-slate-400"
            >
              From
            </label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex flex-1 flex-col gap-1.5">
            <label
              htmlFor="date-to"
              className="text-slate-500 dark:text-slate-400"
            >
              To
            </label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <button
            type="button"
            onClick={() => void loadPersonnelAnalytics()}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Loading..." : "Apply"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
        >
          <Activity className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {!personnelData ? (
        <div className={`${cardClass} py-16 text-center`}>
          <UserRound className="mx-auto mb-3 h-12 w-12 text-slate-400" />
          <h2 className="font-bold text-slate-900 dark:text-white">
            Personnel information not found
          </h2>
          <p className={`mt-1 ${mutedText}`}>
            Verify the personnel record and try again.
          </p>
        </div>
      ) : (
        <>
          {/* Personnel profile */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="h-2 bg-gradient-to-r from-blue-700 via-blue-500 to-indigo-500" />

            <div className="flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 sm:h-20 sm:w-20">
                  <ShieldCheck className="h-9 w-9 sm:h-11 sm:w-11" />
                </div>

                <div className="min-w-0">
                  <h2 className="mt-1 break-words text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
                    {[personnelData.rank?.rank_name, personnelData.fullname]
                      .filter(Boolean)
                      .join(" ") || "Unnamed Personnel"}
                  </h2>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <UserRound className="h-3.5 w-3.5" />
                      Badge: {personnelData.badge_number || "N/A"}
                    </span>

                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                      <MapPin className="h-3.5 w-3.5" />
                      {personnelData.unit?.unit_name || "No assigned unit"}
                    </span>
                  </div>

                  <p className={`mt-3 ${mutedText}`}>
                    {personnelData.designation || "No designation provided"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 lg:max-w-xs lg:justify-end">
                {personnelData.phone_number && (
                  <a
                    href={`tel:${personnelData.phone_number}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-bold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50"
                  >
                    <Phone className="h-4 w-4" />
                    Call
                  </a>
                )}

                {personnelData.viber_number && (
                  <a
                    href={`viber://chat?number=${encodeURIComponent(
                      personnelData.viber_number,
                    )}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 font-bold text-purple-700 transition hover:bg-purple-100 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/50"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Viber
                  </a>
                )}
              </div>
            </div>
          </section>

          {/* Summary cards */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-3">
            <div className={cardClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`font-semibold ${mutedText}`}>Activity Types</p>
                  <p className="mt-3 text-3xl font-black tabular-nums text-slate-900 dark:text-white">
                    {totalActivities.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl bg-indigo-100 p-3 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  <Activity className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className={cardClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`font-semibold ${mutedText}`}>
                    Patrol Duration
                  </p>
                  <p className="mt-3 text-2xl font-black tabular-nums text-slate-900 dark:text-white sm:text-3xl">
                    {formatMinutes(totalPatrolMinutes)}
                  </p>
                </div>
                <div className="rounded-xl bg-blue-100 p-3 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  <Clock3 className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className={cardClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`font-semibold ${mutedText}`}>
                    Kilometers Patrolled
                  </p>
                  <p className="mt-3 text-3xl font-black tabular-nums text-slate-900 dark:text-white">
                    {totalKilometers.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <Route className="h-5 w-5" />
                </div>
              </div>
            </div>
          </section>

          {/* Activity table */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Activity Breakdown
                </h3>
                <p className={`mt-1 ${mutedText}`}>
                  Patrol activity for the selected reporting period.
                </p>
              </div>

              <div className="inline-flex w-fit items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <CalendarDays className="h-4 w-4" />
                {dateFrom || "Any date"} – {dateTo || "Any date"}
              </div>
            </div>

            {dutyTypeStats.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                  <FileText className="h-7 w-7" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white">
                  No activity recorded
                </h4>
                <p className={`mt-1 ${mutedText}`}>
                  No patrol logs were found for this date range.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[700px] w-full divide-y divide-slate-200 dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-800/70">
                    <tr>
                      <th className="w-16 px-5 py-4 text-left text-slate-500 dark:text-slate-400">
                        No.
                      </th>
                      <th className="px-5 py-4 text-left text-slate-500 dark:text-slate-400">
                        Activity / Duty Type
                      </th>
                      <th className="px-5 py-4 text-right text-slate-500 dark:text-slate-400">
                        Patrol Duration
                      </th>
                      <th className="px-5 py-4 text-right text-slate-500 dark:text-slate-400">
                        Distance
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {dutyTypeStats.map((stat, index) => {
                      const special = isSpecialDuty(stat.duty_type);

                      return (
                        <tr
                          key={stat.duty_type}
                          className="transition hover:bg-blue-50/50 dark:hover:bg-slate-800/50"
                        >
                          <td className="px-5 py-4 font-bold tabular-nums text-slate-400">
                            {String(index + 1).padStart(2, "0")}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white">
                                  {stat.duty_type}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <span className="font-mono font-bold tabular-nums text-slate-800 dark:text-slate-100">
                              {special
                                ? formatDuration(stat.duration_hours * 3600)
                                : formatMinutes(stat.patrol_minutes)}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <span className="font-bold tabular-nums text-slate-800 dark:text-slate-100">
                              {special
                                ? "—"
                                : `${stat.kilometer_patrolled.toFixed(2)} km`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot className="border-t-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70">
                    <tr>
                      <td
                        colSpan={2}
                        className="px-5 py-5 font-black uppercase tracking-wide text-slate-900 dark:text-white"
                      >
                        Total
                      </td>
                      <td className="px-5 py-5 text-right">
                        <span className="font-mono font-black tabular-nums text-blue-700 dark:text-blue-300">
                          {formatMinutes(totalPatrolMinutes)}
                        </span>
                      </td>
                      <td className="px-5 py-5 text-right">
                        <span className="font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                          {totalKilometers.toFixed(2)} km
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
