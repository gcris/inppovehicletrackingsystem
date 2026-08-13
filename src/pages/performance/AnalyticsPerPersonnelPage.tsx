import React, { useState, useEffect } from "react";
import { supabase, Unit, PatrolLog, Personnel } from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";
import { useParams } from "react-router-dom";
import { FileText, Phone, MessageCircle, RefreshCcw } from "lucide-react";

export default function AnalyticsPerPersonnelPage() {
  const { id } = useParams();
  const { unitId, isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);

  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(
    null,
  );

  const [personnelData, setPersonnelData] = useState<Personnel | null>(null);

  const [dateFrom, setDateFrom] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  const [dateTo, setDateTo] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  const [dutyTypeStats, setDutyTypeStats] = useState<
    Array<{
      duty_type: string;
      patrol_hours: string;
      kilometer_patrolled: number;
      duration_hours: number;
    }>
  >([]);

  const specialDutyTypes = ["Intel-Driven Operation", "Special Laws"];

  useEffect(() => {
    if (id) {
      setSelectedPersonnelId(id);
    }
  }, [id]);

  useEffect(() => {
    if (selectedPersonnelId) {
      loadPersonnelAnalytics();
    }
  }, [selectedPersonnelId]);

  const loadPersonnelAnalytics = async () => {
    if (!selectedPersonnelId) return;

    try {
      setLoading(true);

      // =========================
      // Load Personnel Information
      // =========================
      const { data: personnel, error: personnelError } = await supabase
        .from("personnel")
        .select(
          `
            *,
            unit(*),
            rank(*)
          `,
        )
        .eq("id", selectedPersonnelId)
        .single();

      if (personnelError) throw personnelError;

      setPersonnelData(personnel);

      // =========================
      // Load Patrol Logs
      // =========================
      let page = 0;
      let hasMore = true;

      let allLogs: PatrolLog[] = [];

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
          .eq("personnel_id", selectedPersonnelId)
          .order("captured_at", { ascending: true })
          .range(page * 1000, page * 1000 + 999);

        if (dateFrom) {
          query = query.gte("captured_at", `${dateFrom}T00:00:00+08:00`);
        }

        if (dateTo) {
          query = query.lte("captured_at", `${dateTo}T23:59:59.999+08:00`);
        }

        query = query.not("duty_type", "eq", "EMERGENCY_SOS");

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

      const statistics = calculateStatisticsByDutyType(allLogs);

      setDutyTypeStats(statistics);
    } catch (err) {
      console.error("Error loading analytics:", err);
    } finally {
      setLoading(false);
    }
  };
  const calculateStatisticsByDutyType = (logs: PatrolLog[]) => {
    const grouped: Record<string, PatrolLog[]> = {};

    logs.forEach((log) => {
      const dutyType = log.duty_type || "Unknown";

      if (!grouped[dutyType]) {
        grouped[dutyType] = [];
      }

      grouped[dutyType].push(log);
    });

    return Object.entries(grouped).map(([dutyType, dutyLogs]) => {
      if (specialDutyTypes.includes(dutyType)) {
        return {
          duty_type: dutyType,
          patrol_hours: "N/A",
          kilometer_patrolled: 0,
          duration_hours: calculateDurationFromLogs(dutyLogs),
        };
      }

      const { patrolHours, totalKilometers } =
        calculatePatrolHoursAndDistance(dutyLogs);

      return {
        duty_type: dutyType,
        patrol_hours: formatHoursToHoursAndMinutes(patrolHours),
        kilometer_patrolled: Number(totalKilometers.toFixed(2)),
        duration_hours: 0,
      };
    });
  };

  const calculatePatrolHoursAndDistance = (logs: PatrolLog[]) => {
    if (logs.length === 0) {
      return {
        patrolHours: 0,
        totalKilometers: 0,
      };
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

      // Ignore long gaps (breaks/off duty)
      if (gapMinutes <= 30) {
        totalMinutes += gapMinutes;
      }
    }

    return {
      patrolHours: totalMinutes / 60,
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

      const dLat = toRadians(end.latitude - start.latitude);
      const dLon = toRadians(end.longitude - start.longitude);

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(start.latitude)) *
          Math.cos(toRadians(end.latitude)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      const segmentDistance = EARTH_RADIUS * c;

      // Ignore GPS jitter below 5 meters
      if (segmentDistance > 0.005) {
        distance += segmentDistance;
      }
    }

    return distance;
  };

  const calculateDurationFromLogs = (logs: PatrolLog[]) => {
    if (logs.length === 0) return 0;

    const sortedLogs = [...logs].sort(
      (a, b) =>
        new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime(),
    );

    const start = new Date(sortedLogs[0].captured_at).getTime();
    const end = new Date(
      sortedLogs[sortedLogs.length - 1].captured_at,
    ).getTime();

    return (end - start) / (1000 * 60 * 60);
  };

  const formatHoursToHoursAndMinutes = (hours: number) => {
    const totalMinutes = Math.round(hours * 60);

    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    if (hrs === 0) {
      return `${mins} minute${mins !== 1 ? "s" : ""}`;
    }

    if (mins === 0) {
      return `${hrs} hour${hrs !== 1 ? "s" : ""}`;
    }

    return `${hrs} hour${hrs !== 1 ? "s" : ""} and ${mins} minute${mins !== 1 ? "s" : ""}`;
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[var(--accent)]/[0.5]" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 gap-6">
        <div>
          <h1 className="text-2xl font-black text-[var(--text)] flex items-center gap-4">
            <FileText className="w-7 h-7" />
            Personnel Analytics Details
          </h1>

          <p className="text-[var(--text)]/[0.8] mt-2">
            Detailed breakdown of patrol hours and kilometer patrolled.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 font-bold text-slate-900 dark:text-white outline-none"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 font-bold text-slate-900 dark:text-white outline-none"
          />

          <button
            onClick={loadPersonnelAnalytics}
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <RefreshCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {!personnelData ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-10 text-center">
          <p className="text-slate-500">Personnel information not found.</p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <div className="flex flex-col lg:flex-row justify-between gap-8">
              <div>
                <h2 className="text-2xl font-black text-[var(--text)]">
                  {personnelData.rank?.rank_name} {personnelData.fullname}
                </h2>

                <div className="mt-6 space-y-3">
                  <div className="flex gap-2">
                    <span className="font-semibold text-black dark:text-white w-36">
                      Badge Number:
                    </span>

                    <span className="font-bold text-[var(--text)]">
                      {personnelData.badge_number || "N/A"}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <span className="font-semibold text-black dark:text-white w-36">
                      Unit / Station:
                    </span>

                    <span className="font-bold text-[var(--text)]">
                      {personnelData.unit?.unit_name || "N/A"}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <span className="font-semibold text-black dark:text-white w-36">
                      Description:
                    </span>

                    <span className="font-bold text-[var(--text)]">
                      {personnelData.designation || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {personnelData.phone_number && (
                  <a
                    href={`tel:${personnelData.phone_number}`}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
                  >
                    <Phone className="w-5 h-5 text-blue-600" />

                    <span className="font-semibold text-blue-700 dark:text-blue-300">
                      {personnelData.phone_number}
                    </span>
                  </a>
                )}

                {personnelData.viber_number && (
                  <a
                    href={`viber://chat?number=${personnelData.viber_number}`}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition"
                  >
                    <MessageCircle className="w-5 h-5 text-purple-600" />

                    <span className="font-semibold text-purple-700 dark:text-purple-300">
                      {personnelData.viber_number}
                    </span>
                  </a>
                )}
              </div>
            </div>
          </div>
          {/* Duty Type Breakdown */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <h3 className="text-lg font-bold text-[var(--text)] mb-4">
              Activity Breakdown
            </h3>

            {dutyTypeStats.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-slate-500">
                  No patrol data found for the selected date range.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-base font-bold tracking-wider text-black dark:text-white">
                        No.
                      </th>

                      <th className="px-6 py-3 text-left text-base font-bold tracking-wider text-black dark:text-white">
                        Activity
                      </th>

                      <th className="px-6 py-3 text-left text-base font-bold tracking-wider text-black dark:text-white">
                        Patrol Hours
                      </th>

                      <th className="px-6 py-3 text-left text-base font-bold tracking-wider text-black dark:text-white">
                        Kilometer Patrolled
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {dutyTypeStats.map((stat, index) => (
                      <tr
                        key={index}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                      >
                        <td className="px-6 py-4 font-semibold text-[var(--text)]">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4 font-semibold text-[var(--text)]">
                          {stat.duty_type}
                        </td>

                        <td className="px-6 py-4 text-center text-[var(--text)]">
                          {specialDutyTypes.includes(stat.duty_type)
                            ? `${stat.duration_hours.toFixed(2)} hrs`
                            : stat.patrol_hours}
                        </td>

                        <td className="px-6 py-4 text-center text-[var(--text)]">
                          {specialDutyTypes.includes(stat.duty_type)
                            ? "-"
                            : `${stat.kilometer_patrolled.toFixed(2)} km`}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold">
                    <tr>
                      <td className="px-6 py-4" colSpan={2}>
                        TOTAL
                      </td>

                      <td className="px-6 py-4 text-center">
                        {dutyTypeStats
                          .filter(
                            (x) => !specialDutyTypes.includes(x.duty_type),
                          )
                          .reduce((sum, item) => {
                            const match = item.patrol_hours.match(
                              /(\d+)\s*hour.*?(\d+)?/,
                            );

                            if (!match) return sum;

                            const hrs = Number(match[1] || 0);
                            const mins = Number(match[2] || 0);

                            return sum + hrs + mins / 60;
                          }, 0)
                          .toFixed(2)}{" "}
                        hrs
                      </td>

                      <td className="px-6 py-4 text-center">
                        {dutyTypeStats
                          .filter(
                            (x) => !specialDutyTypes.includes(x.duty_type),
                          )
                          .reduce(
                            (sum, item) => sum + item.kilometer_patrolled,
                            0,
                          )
                          .toFixed(2)}{" "}
                        km
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
