import React, { useState, useEffect } from "react";
import {
  supabase,
  Unit,
  PatrolLog,
  Personnel,
  PatrolSchedule,
} from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";
import {
  BarChart3,
  FileText,
  Phone,
  MessageCircle,
  RefreshCcw,
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

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [dateTo, setDateTo] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [personnelData, setPersonnelData] = useState<any[]>([]);
  const [dailyTrend, setDailyTrend] = useState<any[]>([]);
  const [patrolTypeDistribution, setPatrolTypeDistribution] = useState<any[]>(
    [],
  );
  const [hourlyTrend, setHourlyTrend] = useState<any[]>([]);
  const [vehicleUtilization, setVehicleUtilization] = useState<any[]>([]);
  const [topPersonnel, setTopPersonnel] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<PatrolSchedule[]>([]);
  const [trendType, setTrendType] = useState<"daily" | "hourly">("daily");
  const [trendMetric, setTrendMetric] = useState<
    "sessions" | "patrolHours" | "manHours" | "kilometers"
  >("sessions");
  const theme = useTheme();
  const [summary, setSummary] = useState({
    total_personnel: 0,
    total_patrol_hours: "00:00:00",
    total_man_hours: 0,
    total_kilometers: 0,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedPatrolType, setSelectedPatrolType] = useState<string>("");
  const patrolTypes = [
    "Mobile Patrol",
    "Foot Patrol",
    "TMRU Patrol",
    "Bike Patrol",
    "Seaborne Patrol",
    "Checkpoint",
    "Simulation Exercise",
    "Special Event",
    "DODON",
    "Intel-Driven Operation",
    "Special Laws",
  ];
  const filteredPersonnel = personnelData.filter((person) => {
    const term = searchTerm.toLowerCase();
    return (
      person.badge_number?.toLowerCase().includes(term) ||
      person.fullname?.toLowerCase().includes(term) ||
      person.rank?.rank_name?.toLowerCase().includes(term) ||
      person.phone_number?.toLowerCase().includes(term) ||
      person.viber_number?.toLowerCase().includes(term)
    );
  });
  const { unitId, isAdmin } = useAuth();

  const isAdminSafe = isAdmin ?? false;
  const unitIdSafe = unitId !== null && unitId !== undefined ? unitId : null;

  const COLORS = [
    "#2563eb",
    "#16a34a",
    "#f59e0b",
    "#dc2626",
    "#7c3aed",
    "#0ea5e9",
  ];

  useEffect(() => {
    loadUnits();
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [selectedUnit, selectedPatrolType]);

  useEffect(() => {
    if (selectedUnit && dateFrom && dateTo) {
      fetchSchedules(selectedUnit, dateFrom, dateTo);
    }
  }, [selectedUnit, dateFrom, dateTo]);

  const loadUnits = async () => {
    try {
      const { data: unitsData, error } = await supabase
        .from("unit")
        .select("*")
        .order("unit_name", { ascending: true });
      if (error) throw error;
      setUnits(unitsData);
    } catch (error) {
      console.error("Error loading units:", error);
    }
  };

  const fetchSchedules = async (
    unitId: string | null,
    dateFrom: string,
    dateTo: string,
  ) => {
    try {
      if (!unitId) return [];

      // Convert dates to the format needed for querying
      // We need to get schedules that overlap with the date range
      const startDate = new Date(dateFrom);
      const endDate = new Date(dateTo);

      const { data: schedulesData, error } = await supabase
        .from("patrol_schedule")
        .select(
          `*,
          schedule_assignments(
            personnel_id,
            personnel:personnel_id(
              *,
              rank(*),
              unit(*)
            )
          )`,
        )
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: true })
        .order("time_from", { ascending: true });

      if (error) throw error;
      return schedulesData ?? [];
    } catch (error) {
      console.error("Error fetching schedules:", error);
      return [];
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      let allData: PatrolLog[] = [];
      let pageNum = 1;
      let hasMore = true;
      let totalCount = 0;

      // Loop to fetch everything, bypassing the 1000 limit, max 10000 points to prevent browser crash
      while (hasMore) {
        const fromRange = (pageNum - 1) * 1000;
        const toRange = pageNum * 1000 - 1;

        // Build the base query for patrol logs with personnel and vehicle details
        let patrolLogsQuery = supabase.from("patrol_logs").select(`
          *,
          personnel:personnel_id (
            *,
            unit(*),
            rank(*)
          ),
          mobility_assets:vehicle_id (*)
        `);

        // Apply date filters if provided
        if (dateFrom) {
          const localStart = `${dateFrom}T00:00:00+08:00`;
          patrolLogsQuery = patrolLogsQuery.gte("captured_at", localStart);
        }
        if (dateTo) {
          const localEnd = `${dateTo}T23:59:59.999+08:00`;
          patrolLogsQuery = patrolLogsQuery.lte("captured_at", localEnd);
        }

        // Apply unit filter if selected
        if (selectedUnit) {
          patrolLogsQuery = patrolLogsQuery.eq(
            "personnel.unit_id",
            selectedUnit,
          );
        }

        // Apply patrol type filter if selected
        if (selectedPatrolType) {
          patrolLogsQuery = patrolLogsQuery.eq("duty_type", selectedPatrolType);
        }

        patrolLogsQuery = patrolLogsQuery.not(
          "duty_type",
          "in",
          '("EMERGENCY_SOS", "Intel-Driven Operation", "Special Laws")',
        );

        // Execute the query
        const { data, error, count } = await patrolLogsQuery
          .order("captured_at", { ascending: true })
          .range(fromRange, toRange);

        if (error) {
          console.error("Error fetching history logs:", error.message);
          break;
        }

        if (count !== null && count !== undefined && pageNum === 1) {
          totalCount = count;
        }

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          pageNum++;
          // If we got less than 1000, we've reached the end
          if (data.length < 1000) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      // Fetch schedules if we have date range and unit
      let schedulesData: PatrolSchedule[] = [];
      if (dateFrom && dateTo && selectedUnit) {
        schedulesData = await fetchSchedules(selectedUnit, dateFrom, dateTo);
      }

      // Calculate statistics using only patrol_logs data (which includes joined personnel/vehicle data)
      const stats = calculateStatistics(allData ?? [], schedulesData);

      // Update state
      setSummary(stats.summary);
      setPersonnelData(stats.personnelData);
      setDailyTrend(stats.charts.dailyTrend);
      setPatrolTypeDistribution(stats.charts.patrolTypeDistribution);
      setHourlyTrend(stats.charts.hourlyTrend);
      setVehicleUtilization(stats.charts.vehicleUtilization);
      setTopPersonnel(stats.charts.topPersonnel);
    } catch (err) {
      console.error("Error loading analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to calculate statistics from patrol_logs data (with joined personnel/vehicle data)
  const calculateStatistics = (
    patrolLogs: any[],
    schedules: PatrolSchedule[],
  ) => {
    // Filter out logs with invalid coordinates
    // const validLogs = patrolLogs.filter((log) => {
    //   const lat = Number(log.latitude);
    //   const lng = Number(log.longitude);
    //   return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    // });

    const dailyTrendMap = new Map<string, number>();
    // ===========================================
    // REBUILD PATROL SESSIONS
    // ===========================================

    interface PatrolSession {
      personnelId: string;
      dutyType: string;
      date: string;
      hour: string;
      minutes: number;
      kilometers: number;
    }

    const patrolSessions: PatrolSession[] = [];

    const logsByPersonnel: Record<string, any[]> = {};

    patrolLogs.forEach((log) => {
      if (!log.personnel_id) return;

      if (!logsByPersonnel[log.personnel_id]) {
        logsByPersonnel[log.personnel_id] = [];
      }

      logsByPersonnel[log.personnel_id].push(log);
    });

    Object.values(logsByPersonnel).forEach((logs) => {
      const sortedLogs = [...logs].sort(
        (a, b) =>
          new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime(),
      );

      let sessionLogs: any[] = [];

      const finalizeSession = () => {
        if (sessionLogs.length === 0) return;

        const first = sessionLogs[0];
        const last = sessionLogs[sessionLogs.length - 1];

        const minutes =
          (new Date(last.captured_at).getTime() -
            new Date(first.captured_at).getTime()) /
          60000;

        patrolSessions.push({
          personnelId: first.personnel_id,
          dutyType: first.duty_type || "Unknown",

          date: first.captured_at.substring(0, 10),

          hour:
            new Date(first.captured_at).getHours().toString().padStart(2, "0") +
            ":00",

          minutes,

          kilometers: calculateDistance(sessionLogs),
        });

        sessionLogs = [];
      };

      sortedLogs.forEach((log) => {
        if (sessionLogs.length === 0) {
          sessionLogs.push(log);
          return;
        }

        const previous = sessionLogs[sessionLogs.length - 1];

        const gap =
          (new Date(log.captured_at).getTime() -
            new Date(previous.captured_at).getTime()) /
          60000;

        if (gap <= 10) {
          sessionLogs.push(log);
        } else {
          finalizeSession();
          sessionLogs.push(log);
        }
      });

      finalizeSession();
    });

    // ===========================================
    // DAILY TREND
    // ===========================================

    const dailyMap = new Map<
      string,
      {
        sessions: number;
        patrolHours: number;
        manHours: number;
        kilometers: number;
      }
    >();

    patrolSessions.forEach((session) => {
      const existing = dailyMap.get(session.date) ?? {
        sessions: 0,
        patrolHours: 0,
        manHours: 0,
        kilometers: 0,
      };

      existing.sessions++;

      existing.patrolHours += session.minutes / 60;

      existing.manHours += session.minutes / 60;

      existing.kilometers += session.kilometers;

      dailyMap.set(session.date, existing);
    });

    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, value]) => ({
        date: new Date(date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        sessions: value.sessions,
        patrolHours: Number(value.patrolHours.toFixed(2)),
        manHours: Number(value.manHours.toFixed(2)),
        kilometers: Number(value.kilometers.toFixed(2)),
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    // ===========================================
    // HOURLY TREND
    // ===========================================

    const hourlyMap = new Map<
      string,
      {
        sessions: number;
        patrolHours: number;
        manHours: number;
        kilometers: number;
      }
    >();

    patrolSessions.forEach((session) => {
      const existing = hourlyMap.get(session.hour) ?? {
        sessions: 0,
        patrolHours: 0,
        manHours: 0,
        kilometers: 0,
      };
      existing.sessions++;
      existing.patrolHours += session.minutes / 60;
      existing.manHours += session.minutes / 60;
      existing.kilometers += session.kilometers;
      hourlyMap.set(session.hour, existing);
    });

    const hourlyTrend = Array.from(hourlyMap.entries())
      .map(([hour, value]) => ({
        hour,
        sessions: value.sessions,
        patrolHours: Number(value.patrolHours.toFixed(2)),
        manHours: Number(value.manHours.toFixed(2)),
        kilometers: Number(value.kilometers.toFixed(2)),
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
    // ===========================================
    // PATROL TYPE DISTRIBUTION
    // ===========================================

    const patrolTypeMap = new Map<string, number>();

    patrolSessions.forEach((session) => {
      patrolTypeMap.set(
        session.dutyType,
        (patrolTypeMap.get(session.dutyType) ?? 0) + 1,
      );
    });

    const patrolTypeDistribution = Array.from(patrolTypeMap.entries())
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort((a, b) => b.value - a.value);

    // Calculate total kilometers using the same logic as in TrackingMapPage
    // ===========================================
    // SUMMARY VARIABLES
    // ===========================================

    const totalKilometers = calculateDistance(patrolLogs);

    let totalPatrolMinutes = 0;
    let totalManMinutes = 0;

    interface PersonnelStatistics {
      personnel: any;
      patrolMinutes: number;
      kilometers: number;
    }

    const personnelMap = new Map<string, PersonnelStatistics>();

    // ===========================================
    // FOOT PATROL
    // ===========================================

    const footLogs = patrolLogs.filter(
      (log) => !log.vehicle_id && log.personnel?.id,
    );

    const footLogsByPersonnel: Record<string, any[]> = {};

    footLogs.forEach((log) => {
      if (!footLogsByPersonnel[log.personnel.id]) {
        footLogsByPersonnel[log.personnel.id] = [];
      }

      footLogsByPersonnel[log.personnel.id].push(log);
    });

    Object.entries(footLogsByPersonnel).forEach(([personId, logs]) => {
      const sortedLogs = [...logs].sort(
        (a, b) =>
          new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime(),
      );

      let patrolMinutes = 0;

      for (let i = 0; i < sortedLogs.length - 1; i++) {
        const gap =
          (new Date(sortedLogs[i + 1].captured_at).getTime() -
            new Date(sortedLogs[i].captured_at).getTime()) /
          60000;

        if (gap < 30) {
          patrolMinutes += gap;
        }
      }

      const kilometers = calculateDistance(sortedLogs);

      totalPatrolMinutes += patrolMinutes;

      totalManMinutes += patrolMinutes;

      personnelMap.set(personId, {
        personnel: sortedLogs[0].personnel,
        patrolMinutes,
        kilometers,
      });
    });

    // ===========================================
    // VEHICLE PATROL
    // ===========================================

    const vehicleLogs = patrolLogs.filter((log) => !!log.vehicle_id);

    const vehicleLogsByVehicle: Record<string, any[]> = {};

    vehicleLogs.forEach((log) => {
      if (!vehicleLogsByVehicle[log.vehicle_id]) {
        vehicleLogsByVehicle[log.vehicle_id] = [];
      }

      vehicleLogsByVehicle[log.vehicle_id].push(log);
    });

    const vehicleUtilization = [] as any;

    Object.entries(vehicleLogsByVehicle).forEach(([vehicleId, logs]) => {
      const sortedLogs = [...logs].sort(
        (a, b) =>
          new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime(),
      );

      const kilometers = calculateDistance(sortedLogs);

      let patrolMinutes = 0;

      const matchedSchedules = schedules.filter(
        (s) => s.mobility_id === vehicleId,
      );

      if (matchedSchedules.length > 0) {
        matchedSchedules.forEach((schedule) => {
          const start = new Date(`${schedule.date}T${schedule.time_from}`);
          const end = new Date(`${schedule.date}T${schedule.time_to}`);

          if (end < start) {
            end.setDate(end.getDate() + 1);
          }

          patrolMinutes += (end.getTime() - start.getTime()) / 60000;
        });
      } else {
        for (let i = 0; i < sortedLogs.length - 1; i++) {
          const gap =
            (new Date(sortedLogs[i + 1].captured_at).getTime() -
              new Date(sortedLogs[i].captured_at).getTime()) /
            60000;

          if (gap < 30) {
            patrolMinutes += gap;
          }
        }
      }

      totalPatrolMinutes += patrolMinutes;

      vehicleUtilization.push({
        vehicleId,
        patrols: logs.length,
        kilometers,
      });

      matchedSchedules.forEach((schedule) => {
        const assignments = schedule.schedule_assignments ?? [];

        totalManMinutes += patrolMinutes * assignments.length;

        // assignments.forEach((assignment: any) => {
        //   const person = assignment.personnel;

        //   if (!person) return;

        //   const existing = personnelMap.get(person.id);

        //   if (existing) {
        //     existing.patrolMinutes += patrolMinutes;
        //     existing.kilometers += kilometers;
        //   } else {
        //     personnelMap.set(person.id, {
        //       personnel: person,
        //       patrolMinutes,
        //       kilometers,
        //     });
        //   }
        // });
      });

      // ===========================================
      // BUILD PERSONNEL STATS FROM VEHICLE LOGS
      // ===========================================

      const vehiclePersonnelLogs: Record<string, any[]> = {};

      sortedLogs.forEach((log) => {
        if (!log.personnel?.id) return;

        if (!vehiclePersonnelLogs[log.personnel.id]) {
          vehiclePersonnelLogs[log.personnel.id] = [];
        }

        vehiclePersonnelLogs[log.personnel.id].push(log);
      });

      Object.entries(vehiclePersonnelLogs).forEach(([personId, logs]) => {
        const person = logs[0].personnel;

        const existing = personnelMap.get(personId);

        if (existing) {
          existing.patrolMinutes += patrolMinutes;
          existing.kilometers += kilometers;

          personnelMap.set(personId, existing);
        } else {
          personnelMap.set(personId, {
            personnel: sortedLogs[0].personnel,
            patrolMinutes,
            kilometers,
          });
        }
      });
    });

    // ===========================================
    // BUILD PERSONNEL LIST
    // ===========================================

    const personnelWithStats = Array.from(personnelMap.values())
      .map((entry) => {
        const hours = Math.floor(entry.patrolMinutes / 60);
        const minutes = Math.round(entry.patrolMinutes % 60);

        return {
          ...entry.personnel,
          patrol_hours: `${hours.toString().padStart(2, "0")}:${minutes
            .toString()
            .padStart(2, "0")}:00`,
          kilometer_patrolled: entry.kilometers.toFixed(2),
        };
      })
      .sort((a, b) => (a.fullname || "").localeCompare(b.fullname || ""));

    // ===========================================
    // TOP PERSONNEL
    // ===========================================

    const topPersonnel = [...personnelWithStats]
      .sort(
        (a, b) =>
          parseFloat(b.kilometer_patrolled) - parseFloat(a.kilometer_patrolled),
      )
      .slice(0, 10);

    // ===========================================
    // SUMMARY
    // ===========================================

    const totalPersonnel = personnelWithStats.length;

    const patrolHours = Math.floor(totalPatrolMinutes / 60);
    const patrolMinutes = Math.round(totalPatrolMinutes % 60);

    const totalManHours = Number((totalManMinutes / 60).toFixed(2));
    4;

    return {
      summary: {
        total_personnel: totalPersonnel,
        total_patrol_hours: `${patrolHours
          .toString()
          .padStart(2, "0")}:${patrolMinutes.toString().padStart(2, "0")}:00`,
        total_man_hours: totalManHours,
        total_kilometers: Number(totalKilometers.toFixed(2)),
      },

      personnelData: personnelWithStats,

      charts: {
        dailyTrend,
        hourlyTrend,
        patrolTypeDistribution,
        vehicleUtilization,
        topPersonnel,
      },
    };
  };

  // Helper function to calculate distance (same as in TrackingMapPage)
  const calculateDistance = (logs: any[]) => {
    if (!logs || logs.length < 2) return 0;

    const EARTH_RADIUS_KM = 6371;
    const deg2rad = (deg: any) => deg * (Math.PI / 180);
    let totalDistance = 0;

    for (let i = 0; i < logs.length - 1; i++) {
      const current = logs[i];
      const next = logs[i + 1];

      // Ensure coordinates are not null/corrupted
      if (
        !current.latitude ||
        !current.longitude ||
        !next.latitude ||
        !next.longitude
      )
        continue;

      const dLat = deg2rad(next.latitude - current.latitude);
      const dLng = deg2rad(next.longitude - current.longitude);

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(current.latitude)) *
          Math.cos(deg2rad(next.latitude)) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = EARTH_RADIUS_KM * c;

      // Jitter Filter: Ignore tiny GPS variations below 5 meters to prevent "ghost mileage"
      if (distance > 0.005) {
        totalDistance += distance;
      }
    }

    return parseFloat(totalDistance.toFixed(2)); // Returns total KM rounded to two decimal places
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 gap-6">
        <div>
          <h1 className="text-2xl font-black text-[var(--text)] flex items-center gap-4">
            <BarChart3 className="w-7 h-7" />
            Performance Analytics
          </h1>
          <p className="text-[var(--text)]/[0.9] mt-2">
            Deep dive into unit/station efficiency
          </p>
        </div>
        <div className="flex flex-wrap items-center bg-white dark:bg-slate-900 rounded-xl border-slate-200 dark:border-slate-800 shadow-sm p-1.5 gap-2 lg:ml-auto transition-colors">
          <div className="flex items-center gap-2 rounded-lg shadow-sm p-1 transition-colors">
            <select
              value={selectedPatrolType || ""}
              onChange={(e) => setSelectedPatrolType(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              <option value="">All Activities</option>
              {patrolTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 rounded-lg shadow-sm p-1 transition-colors">
            <select
              value={selectedUnit || ""}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              <option value="">All Units/Station</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unit_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 rounded-lg shadow-sm p-1 transition-colors">
            <div className="relative">
              <input
                type="date"
                placeholder="Date From"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg shadow-sm p-1 transition-colors">
            <div className="relative">
              <input
                type="date"
                placeholder="Date To"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg shadow-sm p-1 transition-colors">
            <div className="relative">
              <button
                onClick={async (e) => await loadAnalytics()}
                className="p-2.5 bg-white dark:bg-slate-900 dark:slice-800 border border-slice-200 dark:border-slice-800 rounded-xl text-slice-500 dark:text-slice-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-sm"
              >
                <RefreshCcw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent)]/[0.5]"></div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 space-y-8 pb-8">
          <div className="grid-cols-1 md:grid-cols-4 gap-8">
            {(dailyTrend.length > 0 || hourlyTrend.length > 0) && (
              <div className="dark:text-white p-3 rounded-2xl border border-slate-400 dark:border-slate-600 shadow-slate-800 dark:shadow-border-slate-200 transition-colors duration-300 backdrop-blur-sm">
                {/* Header Wrapper */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
                  {/* Left Side: Title */}
                  <h2 className="text-lg font-semibold">
                    Daily Patrol Trend:{" "}
                    {trendMetric === "sessions"
                      ? "Patrol Sessions"
                      : trendMetric === "patrolHours"
                        ? "Patrol Hours"
                        : trendMetric === "manHours"
                          ? "Man-Hours"
                          : "Kilometers Patrolled"}{" "}
                    | <span className="capitalize">{trendType}</span>
                  </h2>

                  {/* Right Side: Grouped Controls (Dropdown + Toggle) */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* 1. Dropdown (Removed the limiting w-[122px] wrapper so option text doesn't cut off) */}
                    <select
                      value={trendMetric}
                      onChange={(e) => setTrendMetric(e.target.value as any)}
                      className="text-base rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 p-1 focus:outline-none h-[30px]"
                    >
                      <option value="sessions">Patrol Sessions</option>
                      <option value="patrolHours">Patrol Hours</option>
                      <option value="manHours">Man-Hours</option>
                      <option value="kilometers">Kilometers Patrolled</option>
                    </select>

                    {/* 2. Toggle Switch */}
                    <div className="flex rounded-md overflow-hidden border border-slate-400 dark:border-slate-600 h-[30px] shrink-0">
                      <button
                        onClick={() => setTrendType("hourly")}
                        className={`px-3 text-md ${
                          trendType === "hourly"
                            ? "bg-blue-600 text-white"
                            : "bg-white text-gray-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        Hourly
                      </button>

                      <button
                        onClick={() => setTrendType("daily")}
                        className={`px-3 text-sm ${
                          trendType === "daily"
                            ? "bg-blue-600 text-white"
                            : "bg-white text-gray-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        Daily
                      </button>
                    </div>
                  </div>
                </div>

                {/* Chart Container */}
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={trendType === "daily" ? dailyTrend : hourlyTrend}
                  >
                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis
                      dataKey={trendType === "daily" ? "date" : "hour"}
                      tick={{
                        fill: theme === "dark" ? "#f4f4f4" : "#000000",
                        fontSize: 20,
                        fontWeight: 600,
                      }}
                    />

                    <YAxis
                      tick={{
                        fill: theme === "dark" ? "#f4f4f4" : "#000000",
                        fontSize: 20,
                        fontWeight: 600,
                      }}
                      tickFormatter={(value) => {
                        switch (trendMetric) {
                          case "kilometers":
                            return `${value} km`;

                          case "patrolHours":
                            return `${value} h`;

                          case "manHours":
                            return `${value} h`;

                          default:
                            return value;
                        }
                      }}
                    />

                    <Tooltip
                      formatter={(value: any) => {
                        switch (trendMetric) {
                          case "sessions":
                            return [value, "Patrol Sessions"];

                          case "patrolHours":
                            return [`${value} hrs`, "Patrol Hours"];

                          case "manHours":
                            return [`${value} hrs`, "Man-Hours"];

                          case "kilometers":
                            return [`${value} km`, "Kilometers Patrolled"];

                          default:
                            return [value];
                        }
                      }}
                    />

                    <Line
                      type="monotone"
                      dataKey={trendMetric}
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ r: 5 }}
                      activeDot={{ r: 7 }}
                      label={{
                        position: "top",
                        fontSize: 20,
                        fontWeight: 600,
                        fill: theme === "dark" ? "#f4f4f4" : "#000000",
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="dark:text-white p-8 rounded-2xl border border-slate-400 dark:border-slate-600 shadow-slate-800 dark:shadow-border-slate-200 transition-colors duration-300 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--text)]/[0.9] mb-2">
                    Total no. of Personnel
                  </p>
                  <p className="text-5xl font-bold text-[var(--text)]">
                    {summary.total_personnel}
                  </p>
                </div>
              </div>
            </div>
            <div className="dark:text-white p-8 rounded-2xl border border-slate-400 dark:border-slate-600 shadow-slate-800 dark:shadow-border-slate-200 transition-colors duration-300 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--text)]/[0.9] mb-2">
                    Total Patrolled Hour
                  </p>
                  <p className="text-5xl font-bold text-[var(--text)]">
                    {summary.total_patrol_hours}
                  </p>
                </div>
              </div>
            </div>
            <div className="dark:text-white p-8 rounded-2xl border border-slate-400 dark:border-slate-600 shadow-slate-800 shadow-[var(--accent)]/[0.15] dark:shadow-[var(--accent)]/[0.08] transition-colors duration-300 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--text)]/[0.9] mb-2">
                    Total Man-Hour
                  </p>
                  <p className="text-5xl font-bold text-[var(--text)]">
                    {summary.total_man_hours.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
            <div className="dark:text-white p-8 rounded-2xl border border-slate-400 dark:border-slate-600 shadow-slate-800 shadow-[var(--accent)]/[0.15] dark:shadow-[var(--accent)]/[0.08] transition-colors duration-300 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--text)]/[0.9] mb-2">
                    Total Kilometer Patrolled
                  </p>
                  <p className="text-5xl font-bold text-[var(--text)]">
                    {summary.total_kilometers}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-1 gap-8">
            <div className="dark:text-white p-4 rounded-2xl border border-[var(--secondary)]/[0.35] dark:border-[var(--secondary)]/[0.25] shadow-[var(--accent)]/[0.15] dark:shadow-[var(--accent)]/[0.08] transition-colors duration-300 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-black text-[var(--text)]/[0.9] text-[18px] flex items-center gap-4">
                  <FileText className="w-5 h-5" />
                  Personnel Patrol Report
                </h3>
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    placeholder="Search personnel..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="min-w-[350px] px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col transition-colors overflow-x-auto">
                <table>
                  <thead>
                    <tr className="border-b border-[var(--secondary)]/[0.2] dark:border-[var(--secondary)]/[0.1] bg-[var(--primary)]/[0.05] dark:bg-[var(--primary)]/[0.02]">
                      <th className="px-6 py-3 text-black dark:text-white">
                        #
                      </th>
                      <th className="px-6 py-3 text-black dark:text-white">
                        Badge Number
                      </th>
                      <th className="px-6 py-3 text-black dark:text-white">
                        Rank/Name
                      </th>
                      {/* <th className="px-6 py-3 text-black dark:text-white">
                        Contact Info
                      </th> */}
                      <th className="px-6 py-3 text-black dark:text-white">
                        Patrolled Hour
                      </th>
                      <th className="px-6 py-3 text-black dark:text-white">
                        Kilometer Patrolled
                      </th>
                      <th className="px-6 py-3 text-black dark:text-white">
                        Acitons
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--secondary)]/[0.2]">
                    {filteredPersonnel.length > 0 ? (
                      filteredPersonnel.map((person, index) => (
                        <tr
                          key={index}
                          className="bg-[var(--primary)]/[0.02] hover:bg-[var(--secondary)]/[0.03]"
                          onClick={() => {
                            window.location.href = `/analytics-per-personnel/${person.id}`;
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            {index + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {person.badge_number || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {person.rank?.rank_name || "N/A"}{" "}
                            {person.fullname || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {person.patrol_hours}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {person.kilometer_patrolled}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <Link
                              to={`/analytics-per-personnel/${person.id}`}
                              className="bg-[var(--primary)]/[0.05] hover:bg-[var(--primary)]/[0.1] text-[var(--text)]/[0.9] hover:text-[var(--text)] px-4 py-2 rounded-md text-sm font-medium transition-colors"
                            >
                              Details
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-6 py-10 text-center text-[var(--text)]/[0.6]"
                        >
                          No personnel data available for the selected time
                          range
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
