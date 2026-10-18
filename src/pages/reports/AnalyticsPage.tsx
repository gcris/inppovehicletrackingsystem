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
  Barcode,
  Check,
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

  const getLocalDateString = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const [dateFrom, setDateFrom] = useState(getLocalDateString);
  const [dateTo, setDateTo] = useState(getLocalDateString);

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
  }, [selectedUnit, selectedPatrolType, dateFrom, dateTo]);

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
    // Foot Patrolling
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
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

          {/* UNIT */}
          <div>
            <label className="mb-1.5 block font-semibold text-slate-600 dark:text-slate-300">
              Unit / Station
            </label>
            <select
              value={selectedUnit ?? ""}
              onChange={(e) => setSelectedUnit(e.target.value || null)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">All Units / Stations</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unit_name}
                </option>
              ))}
            </select>
          </div>

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
                  <RefreshCcw className="h-6 w-6" />
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
                  <Barcode className="h-6 w-6" />
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
                    <th className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                      Badge Number
                    </th>
                    <th className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                      Rank / Name
                    </th>
                    <th className="px-5 py-3.5 text-center text-slate-500 dark:text-slate-400">
                      Patrol Hours
                    </th>
                    <th className="px-5 py-3.5 text-center text-slate-500 dark:text-slate-400">
                      Kilometers
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
