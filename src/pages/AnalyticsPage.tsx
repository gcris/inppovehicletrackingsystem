import React, { useState, useEffect } from "react";
import {
  supabase,
  MobilityAsset,
  Unit,
  VehicleLog,
  PatrolSchedule,
  Personnel,
} from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";
import {
  BarChart3,
  TrendingUp,
  Zap,
  Clock,
  Shield,
  AlertCircle,
  FileText,
  Download,
  Filter,
  Phone,
  MessageCircle,
} from "lucide-react";
import { format, subDays, formatDistanceToNow } from "date-fns";
import { start } from "repl";

// Type definition for vehicle logs with joined mobility asset data
type VehicleLogSelection = VehicleLog & {
  mobility_assets: {
    unit_id: string;
  };
};

// Haversine formula to calculate distance between two coordinates in kilometers
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper to group logs into sessions based on interval
const groupLogsBySession = (
  allLogs: VehicleLogSelection[],
  thresholdMinutes = 10,
) => {
  if (allLogs.length === 0) return [];
  const sessions: VehicleLogSelection[][] = [];
  let currentSession: VehicleLogSelection[] = [allLogs[0]];

  for (let i = 1; i < allLogs.length; i++) {
    const prevTime = new Date(allLogs[i - 1].captured_at).getTime();
    const currTime = new Date(allLogs[i].captured_at).getTime();
    const diffMinutes = (currTime - prevTime) / 60000;

    if (diffMinutes > thresholdMinutes) {
      sessions.push(currentSession);
      currentSession = [allLogs[i]];
    } else {
      currentSession.push(allLogs[i]);
    }
  }
  sessions.push(currentSession);
  return sessions;
};

type ProcessedPersonnel = Personnel & {
  hour_patrolled: number;
  man_hour: number;
  kilometer_patrolled: number;
};

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [personnelData, setPersonnelData] = useState<ProcessedPersonnel[]>([]);
  const [stats, setStats] = useState({
    patrolHours: [] as any[],
    signalLogs: [] as any[],
    avgSpeed: 0,
    avgSignal: 84,
    weeklyHours: 0,
    activeAlerts: 0,
    totalHourPatrolled: 0,
    totalManHour: 0,
    totalKilometerPatrolled: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const filteredPersonnel = personnelData.filter((person) => {
    const term = searchTerm.toLowerCase();
    return (
      person.badge_number?.toLowerCase().includes(term) ||
      person.fullname.toLowerCase().includes(term) ||
      person.rank?.rank_name?.toLowerCase().includes(term) ||
      person.phone_number?.toLowerCase().includes(term) ||
      person.viber_number?.toLowerCase().includes(term)
    );
  });
  const { unitId, isAdmin } = useAuth();
  // Handle case where auth is still loading
  const isAdminSafe = isAdmin ?? false;
  const unitIdSafe = unitId !== null && unitId !== undefined ? unitId : null;

  useEffect(() => {
    fetchAnalytics();
    fetchPersonnelReport();
  }, [selectedDate]);

  const fetchPersonnelReport = async () => {
    try {
      // Fetch personnel report for the selected date only
      const selectedDateStr = selectedDate;
      const rangeStart = `${selectedDateStr}T00:00:00.000+08:00`;
      const rangeEnd = `${selectedDateStr}T23:59:59.999+08:00`;

      // Fetch personnel with their ranks and contact info
      const { data: personnelData, error: personnelError } = await supabase
        .from("personnel")
        .select("*, rank(*)")
        .order("rank(level)", { ascending: false })
        .order("fullname", { ascending: true });

      if (personnelError) throw personnelError;

      // Fetch patrol schedules and their assignments for the date range to calculate hours
      const { data: patrolSchedules, error: patrolSchedulesError } =
        await supabase
          .from("patrol_schedule")
          .select("*, schedule_assignments(*, personnel(id))")
          .neq("patrol_type", "Remain in Office")
          .gte("date", rangeStart.split("T")[0])
          .lte("date", rangeEnd.split("T")[0]);

      if (patrolSchedulesError) throw patrolSchedulesError;

      let vehicleLogs: VehicleLog[] = [];
      let pageNum = 1;
      let hasMore = true;
      let totalCount = 0;

      // Loop to fetch everything, bypassing the 1000 limit, max 10000 points to prevent browser crash
      while (hasMore && vehicleLogs.length < 10000) {
        const fromRange = (pageNum - 1) * 1000;
        const toRange = pageNum * 1000 - 1;

        const { data, error, count } = await supabase
          .from("vehicle_logs")
          .select("*, mobility_assets(unit_id)")
          .gte("captured_at", rangeStart)
          .lte("captured_at", rangeEnd)
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
          vehicleLogs = [...vehicleLogs, ...data];
          pageNum++;
          // If we got less than 1000, we've reached the end
          if (data.length < 1000) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      // Cast vehicleLogs to the correct type for processing
      const typedVehicleLogs = vehicleLogs as VehicleLogSelection[];

      // Process data to calculate metrics per personnel
      const processedPersonnel = personnelData.map((person) => {
        // Create maps for efficient lookup (shared between hour and distance calculations)
        const scheduleToPersonnelMap: Record<string, string[]> = {};
        (patrolSchedules || []).forEach((schedule) => {
          const personnelIds = (schedule.schedule_assignments || [])
            .map(
              (assignment: { personnel_id: string }) => assignment.personnel_id,
            )
            .filter((id): id is string => id !== null && id !== undefined);
          if (schedule.id && personnelIds.length > 0) {
            scheduleToPersonnelMap[schedule.id] = personnelIds;
          }
        });

        const assetToScheduleMap: Record<string, string> = {};
        (patrolSchedules || []).forEach((schedule) => {
          if (schedule.mobility_id) {
            assetToScheduleMap[schedule.mobility_id] = schedule.id;
          }
        });

        // Group logs by vehicle
        const logsByVehicle: Record<string, VehicleLogSelection[]> = {};
        typedVehicleLogs.forEach((log) => {
          if (!logsByVehicle[log.vehicle_id]) {
            logsByVehicle[log.vehicle_id] = [];
          }
          logsByVehicle[log.vehicle_id].push(log);
        });

        // Calculate hour patrolled and man-hour from vehicle_logs that match patrol_schedule for this person
        let hourPatrolled = 0;
        let manHour = 0;

        // Create a map of schedule_id to schedule time range for quick lookup
        const scheduleTimeMap: Record<
          string,
          { startTime: number; endTime: number }
        > = {};
        // Also create a map for personnel count per schedule
        const schedulePersonnelCountMap: Record<string, number> = {};
        (patrolSchedules || []).forEach((schedule) => {
          if (schedule.time_from && schedule.time_to) {
            const [fH, fM] = schedule.time_from.split(":").map(Number);
            const [tH, tM] = schedule.time_to.split(":").map(Number);
            let startMinutes = fH * 60 + fM;
            let endMinutes = tH * 60 + tM;
            if (endMinutes < startMinutes) endMinutes += 24 * 60; // Overnight shift
            scheduleTimeMap[schedule.id] = {
              startTime: startMinutes * 60 * 1000, // Convert to milliseconds
              endTime: endMinutes * 60 * 1000,
            };
          }
          // Calculate personnel count for this schedule
          const personnelCount =
            schedule.schedule_assignments?.reduce(
              (count: number, assignment: { personnel_id: string }) => {
                return assignment.personnel_id ? count + 1 : count;
              },
              0,
            ) || 0;
          schedulePersonnelCountMap[schedule.id] = personnelCount;
        });

        // For each schedule assignment of this person, find matching vehicle logs
        (patrolSchedules || []).forEach((schedule) => {
          // Check if this person is assigned to this schedule
          const personAssignments =
            schedule.schedule_assignments?.filter(
              (assignment: { personnel_id: string }) =>
                assignment.personnel_id === person.id,
            ) || [];
          if (
            personAssignments.length > 0 &&
            schedule.id &&
            scheduleTimeMap[schedule.id]
          ) {
            const scheduleTime = scheduleTimeMap[schedule.id];
            const personnelCount = schedulePersonnelCountMap[schedule.id] || 0;

            // Filter vehicle logs that occurred during this schedule's time on this date
            const matchingLogs = typedVehicleLogs.filter((log) => {
              const logTime = new Date(log.captured_at).getTime();
              const baseDate = new Date(
                `${selectedDateStr}T00:00:00.000+08:00`,
              );
              const startTime = baseDate.getTime() + scheduleTime.startTime;
              const endTime = baseDate.getTime() + scheduleTime.endTime;

              return logTime >= startTime && logTime <= endTime;
            });

            // Calculate time duration from matching logs
            if (matchingLogs.length > 1) {
              const firstLogTime = new Date(
                matchingLogs[0].captured_at,
              ).getTime();
              const lastLogTime = new Date(
                matchingLogs[matchingLogs.length - 1].captured_at,
              ).getTime();
              let durationMinutes = (lastLogTime - firstLogTime) / (1000 * 60); // Convert to minutes

              // Only count if we have valid duration (non-negative)
              if (durationMinutes >= 0) {
                const durationHours = durationMinutes / 60;
                hourPatrolled += durationHours;
                // Man-hour calculation: hour patrolled × number of personnel assigned to schedule
                manHour += durationHours * personnelCount;
              }
            }
          }
        });

        // Calculate kilometer patrolled from vehicle logs
        let kilometerPatrolled = 0;
        // Calculate distance for each vehicle's logs
        Object.keys(logsByVehicle).forEach((vehicleId: string) => {
          const vehicleLogs = logsByVehicle[vehicleId] || [];
          const scheduleId = assetToScheduleMap[vehicleId];

          if (
            scheduleId &&
            scheduleToPersonnelMap[scheduleId]?.includes(person.id) &&
            vehicleLogs.length > 1
          ) {
            for (let i = 1; i < vehicleLogs.length; i++) {
              const prev = vehicleLogs[i - 1];
              const curr = vehicleLogs[i];

              // Only calculate distance if within reasonable time gap (e.g., 5 minutes)
              const timeDiff =
                new Date(curr.captured_at).getTime() -
                new Date(prev.captured_at).getTime();
              if (timeDiff <= 5 * 60 * 1000) {
                // 5 minutes in milliseconds
                const distance = calculateDistance(
                  prev.latitude,
                  prev.longitude,
                  curr.latitude,
                  curr.longitude,
                );
                kilometerPatrolled += distance;
              }
            }
          }
        });

        // Convert rank array to single object (take first element if exists)
        const rankData =
          Array.isArray(person.rank) && person.rank.length > 0
            ? person.rank[0]
            : person.rank;

        return {
          ...person,
          rank: rankData,
          hour_patrolled: Number(hourPatrolled.toFixed(1)),
          man_hour: Number(hourPatrolled.toFixed(1)), // Individual man-hour equals hours worked
          kilometer_patrolled: Number(kilometerPatrolled.toFixed(2)),
        };
      });

      setPersonnelData(processedPersonnel);
    } catch (err) {
      console.error("Error fetching personnel report:", err);
      // Set empty array on error to avoid breaking UI
      setPersonnelData([]);
    }
  };

  // Helper function to format hours to "X hour(s) and Y minute(s)" format
  const formatHoursToHoursAndMinutes = (hours: number) => {
    const totalMinutes = Math.round(hours * 60);
    const hoursPart = Math.floor(totalMinutes / 60);
    const minutesPart = totalMinutes % 60;

    if (hoursPart === 0) {
      return `${minutesPart} m`;
    }
    if (minutesPart === 0) {
      return `${hoursPart} hour${hoursPart !== 1 ? "s" : ""}`;
    }
    return `${hoursPart} h & ${minutesPart} m`;
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch analytics data for the selected date only
      const selectedDateStr = selectedDate;
      const rangeStart = `${selectedDateStr}T00:00:00.000+08:00`;
      const rangeEnd = `${selectedDateStr}T23:59:59.999+08:00`;

      // Build queries with unit filtering for non-admin users
      let unitsQuery = supabase.from("unit").select("*");
      let vehiclesQuery = supabase.from("mobility_assets").select("*");
      let scheduleQuery = supabase
        .from("patrol_schedule")
        .select("*, unit(*), schedule_assignments(*, personnel(*))")
        .eq("date", rangeStart.split("T")[0]);

      // Apply unit filtering for non-admin users
      // Explicitly check for null/undefined to handle unitId = 0 case
      if (!isAdminSafe && unitIdSafe !== null) {
        unitsQuery = unitsQuery.eq("id", unitIdSafe);
        vehiclesQuery = vehiclesQuery.eq("unit_id", unitIdSafe);
        // For logs, we need to filter by mobility asset's unit_id
        // For schedules, filter by unit_id
        scheduleQuery = scheduleQuery.eq("unit_id", unitIdSafe);
      }

      let vehicleLogs: VehicleLog[] = [];
      let pageNum = 1;
      let hasMore = true;
      let totalCount = 0;

      // Loop to fetch everything, bypassing the 1000 limit, max 10000 points to prevent browser crash
      while (hasMore && vehicleLogs.length < 10000) {
        const fromRange = (pageNum - 1) * 1000;
        const toRange = pageNum * 1000 - 1;

        const { data, error, count } = await supabase
          .from("vehicle_logs")
          .select("*, mobility_assets(unit_id)")
          .gte("captured_at", rangeStart)
          .lte("captured_at", rangeEnd)
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
          vehicleLogs = [...vehicleLogs, ...data];
          pageNum++;
          // If we got less than 1000, we've reached the end
          if (data.length < 1000) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      const [unitsRes, vehiclesRes, scheduleRes] = await Promise.all([
        unitsQuery,
        vehiclesQuery,
        scheduleQuery,
      ]);

      if (unitsRes.error) throw unitsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (scheduleRes.error) throw scheduleRes.error;

      // Type assertions for better type safety
      const schedules = scheduleRes.data as (PatrolSchedule & {
        unit: Unit;
        schedule_assignments: { personnel: { id: string } }[];
      })[];
      const logs = vehicleLogs as (VehicleLog & {
        mobility_assets: { unit_id: string };
      })[];

      // Filter logs to only include those from user's unit (for non-admin)
      let filteredLogsData = logs;
      if (!isAdminSafe && unitIdSafe !== null && logs) {
        filteredLogsData = logs.filter(
          (log) =>
            log.mobility_assets && log.mobility_assets.unit_id === unitIdSafe,
        );
      }

      // 1. Compute total hour patrolled (using session grouping on all logs for the day)
      let totalHourPatrolled = 0;
      const allSessions = groupLogsBySession(filteredLogsData, 10); // 10-minute threshold
      for (const session of allSessions) {
        const start = new Date(session[0].captured_at).getTime();
        const end = new Date(session[session.length - 1].captured_at).getTime();
        totalHourPatrolled += (end - start) / (1000 * 60 * 60); // convert ms to hours
      }

      // 2. Compute total man-hour: for each schedule, calculate overlap between schedule time and patrol time
      let totalManHour = 0;
      for (const schedule of schedules) {
        // Filter logs that are in this schedule's date and time range
        const scheduleLogs = filteredLogsData.filter((log) => {
          const logTime = new Date(log.captured_at);

          // 1. Get the local date string (YYYY-MM-DD) matching your local timezone
          const logDate = logTime.toLocaleDateString("en-CA", {
            timeZone: "Asia/Manila",
          });
          if (logDate !== schedule.date) return false;

          // 2. Get local hours and minutes directly (Bypasses the UTC string-splitting trap)
          const logH = parseInt(
            logTime.toLocaleTimeString("en-US", {
              hour: "2-digit",
              hour12: false,
              timeZone: "Asia/Manila",
            }),
            10,
          );
          const logM = logTime.getMinutes();
          const logTotalMinutes = logH * 60 + logM;

          // --- Schedule logic ---
          const [scheduleStartH, scheduleStartM] = schedule.time_from
            .split(":")
            .map(Number);
          const [scheduleEndH, scheduleEndM] = schedule.time_to
            .split(":")
            .map(Number);
          const scheduleStartMinutes = scheduleStartH * 60 + scheduleStartM;
          const scheduleEndMinutes = scheduleEndH * 60 + scheduleEndM;

          if (scheduleEndMinutes < scheduleStartMinutes) {
            // Overnight shift
            return (
              logTotalMinutes >= scheduleStartMinutes ||
              logTotalMinutes <= scheduleEndMinutes
            );
          } else {
            // Normal shift
            return (
              logTotalMinutes >= scheduleStartMinutes &&
              logTotalMinutes <= scheduleEndMinutes
            );
          }
        });

        // Now compute the patrol time within scheduleLogs using session grouping
        let schedulePatrolHours = 0;
        if (scheduleLogs.length > 0) {
          const grouped = groupLogsBySession(scheduleLogs, 10); // threshold 10 minutes
          for (const session of grouped) {
            const start = new Date(session[0].captured_at).getTime();
            const end = new Date(
              session[session.length - 1].captured_at,
            ).getTime();
            schedulePatrolHours += (end - start) / (1000 * 60 * 60);
          }
        }

        // Count unique personnel in this schedule
        const personnelIds = new Set<string>();
        for (const assign of schedule.schedule_assignments || []) {
          if (assign.personnel?.id) {
            personnelIds.add(assign.personnel.id);
          }
        }
        const personnelCount = personnelIds.size;

        totalManHour += schedulePatrolHours * personnelCount;
      }

      // 3. Compute kilometer patrolled per vehicle (sum of distances between consecutive points within 5 min)
      const vehicleKilometersMap = new Map<string, number>();
      // Group logs by vehicle
      const logsByVehicle: Record<string, typeof filteredLogsData> = {};
      for (const log of filteredLogsData) {
        const vid = log.vehicle_id;
        if (!logsByVehicle[vid]) {
          logsByVehicle[vid] = [];
        }
        logsByVehicle[vid].push(log);
      }
      for (const [vid, vehicleLogs] of Object.entries(logsByVehicle)) {
        const sorted = [...vehicleLogs].sort(
          (a, b) =>
            new Date(a.captured_at).getTime() -
            new Date(b.captured_at).getTime(),
        );
        let total = 0;
        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1];
          const curr = sorted[i];
          const timeDiff =
            new Date(curr.captured_at).getTime() -
            new Date(prev.captured_at).getTime();
          if (timeDiff <= 5 * 60 * 1000) {
            // 5 minutes in milliseconds
            const distance = calculateDistance(
              prev.latitude,
              prev.longitude,
              curr.latitude,
              curr.longitude,
            );
            total += distance;
          }
        }
        vehicleKilometersMap.set(vid, total);
      }

      let totalKilometerPatrolled = 0;
      vehicleKilometersMap.forEach((km) => {
        totalKilometerPatrolled += km;
      });

      // 5. Patrol hours based on schedule date and time (for selected date only) - keep original for compatibility
      const daySchedules = schedules.filter((s) => s.date === selectedDateStr);
      let hours = 0;
      daySchedules.forEach((s) => {
        if (s.time_from && s.time_to) {
          const [fH, fM] = s.time_from.split(":").map(Number);
          const [tH, tM] = s.time_to.split(":").map(Number);
          let diffMinutes = tH * 60 + (tM || 0) - (fH * 60 + (fM || 0));
          if (diffMinutes < 0) diffMinutes += 24 * 60; // Overnight shift
          hours += diffMinutes / 60;
        }
      });
      const patrolHours = [
        {
          day: format(new Date(selectedDateStr), "EEE, MMM d"),
          date: selectedDateStr,
          hours: Number(hours.toFixed(1)),
        },
      ];
      const weeklyHours = Math.round(totalHourPatrolled); // changed to log-based hours

      // 6. Average Speed, Signals, & Active Alerts (keep existing logic)
      let signalLogs: { time: string; signal: number; speed: number }[] = [];
      let avgSpeed = 0;
      let activeAlerts = 0;
      let avgSignal = 84;

      if (filteredLogsData.length > 0) {
        const sortedLogData = [...filteredLogsData].sort(
          (a, b) =>
            new Date(a.captured_at).getTime() -
            new Date(b.captured_at).getTime(),
        );

        const avgSpeedCalc =
          sortedLogData.reduce(
            (a: number, b: VehicleLogSelection) => a + Number(b.speed || 0),
            0,
          ) / sortedLogData.length;
        avgSpeed = Number(avgSpeedCalc.toFixed(1));

        // Sampling down for dense/performance on charts (max 20 points)
        const sampleCount = 20;
        const step = Math.max(
          1,
          Math.floor(sortedLogData.length / sampleCount),
        );
        const sampledLogs = [];
        for (let i = 0; i < sortedLogData.length; i += step) {
          sampledLogs.push(sortedLogData[i]);
        }

        signalLogs = sampledLogs.map((l) => ({
          time: format(new Date(l.captured_at), "MMM dd HH:mm"),
          signal: l.network_signal || 0,
          speed: Number(l.speed || 0),
        }));

        activeAlerts = sortedLogData.filter(
          (l) => (l.network_signal || 0) < 20,
        ).length;

        const totalSignal = sortedLogData.reduce(
          (sum, l) => sum + (l.network_signal || 0),
          0,
        );
        avgSignal = Math.round(totalSignal / sortedLogData.length);
      }

      // 7. Set stats
      setStats({
        patrolHours,
        signalLogs,
        avgSpeed,
        avgSignal: filteredLogsData.length > 0 ? avgSignal : ("--" as any),
        weeklyHours,
        activeAlerts,
        totalHourPatrolled,
        totalManHour,
        totalKilometerPatrolled,
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("Error fetching analytics:", err.message);
      } else {
        console.error("Error fetching analytics:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  const COLORS = [
    "#0369A1", // Primary accent (blue)
    "#7C3AED", // Violet
    "#DB2777", // Pink
    "#EA580C", // Orange
    "#16A34A", // Green
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 gap-6">
        <div>
          <h1 className="text-2xl font-black text-[var(--text)] flex items-center gap-4">
            <BarChart3 className="w-7 h-7" />
            Performance Analytics
          </h1>
          <p className="text-[var(--text)]/[0.9] mt-2">
            Deep dive into unit efficiency and fleet health
          </p>
        </div>

        <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-1 transition-colors">
          <div className="relative">
            <input
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              className="w-full py-2 pl-2 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer"
              onChange={(e) => {
                setSelectedDate(e.target.value);
              }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent)]/[0.5]"></div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 space-y-8 pb-8">
          {/* Top Row Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="dark:text-white p-8 rounded-2xl border border-slate-400 dark:border-slate-600 shadow-slate-800 dark:shadow-border-slate-200 transition-colors duration-300 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                {/* <div className="p-5 rounded-xl border border-[var(--secondary)]/[0.25]">
                  <TrendingUp className="w-6 h-6" />
                </div> */}
                <div>
                  <p className="text-[var(--text)]/[0.9] mb-2">
                    Total Hour Patrolled
                  </p>
                  <p className="text-5xl font-bold text-[var(--text)]">
                    {formatHoursToHoursAndMinutes(stats.totalHourPatrolled)}
                  </p>
                </div>
              </div>
            </div>
            <div className="dark:text-white p-8 rounded-2xl border border-slate-400 dark:border-slate-600 shadow-slate-800 shadow-[var(--accent)]/[0.15] dark:shadow-[var(--accent)]/[0.08] transition-colors duration-300 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                {/* <div className="p-5 rounded-xl border border-[var(--secondary)]/[0.25]">
                  <Clock className="w-6 h-6" />
                </div> */}
                <div>
                  <p className="text-[var(--text)]/[0.9] mb-2">
                    Total Man-Hour
                  </p>
                  <p className="text-5xl font-bold text-[var(--text)]">
                    {formatHoursToHoursAndMinutes(stats.totalManHour)}
                  </p>
                </div>
              </div>
            </div>
            <div className="dark:text-white p-8 rounded-2xl border border-slate-400 dark:border-slate-600 shadow-slate-800 shadow-[var(--accent)]/[0.15] dark:shadow-[var(--accent)]/[0.08] transition-colors duration-300 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                {/* <div className="p-5 rounded-xl border border-[var(--secondary)]/[0.25]">
                  <Zap className="w-6 h-6 text-amber-500" />
                </div> */}
                <div>
                  <p className="text-[var(--text)]/[0.9] mb-2">
                    Total Kilometer Patrolled
                  </p>
                  <p className="text-5xl font-bold text-[var(--text)]">
                    {stats.totalKilometerPatrolled.toFixed(2)} km
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-1 gap-8">
            {/* Personnel List */}
            <div className="dark:text-white p-4 rounded-2xl border border-[var(--secondary)]/[0.35] dark:border-[var(--secondary)]/[0.25] shadow-[var(--accent)]/[0.15] dark:shadow-[var(--accent)]/[0.08] transition-colors duration-300 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-black text-[var(--text)]/[0.9] text-[16px] flex items-center gap-4">
                  <FileText className="w-5 h-5" />
                  Personnel Patrol Report
                </h3>
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    placeholder="Search personnel..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="min-w-[350px] px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
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
                      <th className="px-6 py-3 text-black dark:text-white">
                        Contact Info
                      </th>
                      <th className="px-6 py-3 text-black dark:text-white">
                        Hour Patrolled
                      </th>
                      <th className="px-6 py-3 text-black dark:text-white">
                        Man-Hour
                      </th>
                      <th className="px-6 py-3 text-black dark:text-white">
                        Kilometer Patrolled
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--secondary)]/[0.2]">
                    {filteredPersonnel.length > 0 ? (
                      filteredPersonnel.map((person, index) => (
                        <tr
                          key={index}
                          className="bg-[var(--primary)]/[0.02] hover:bg-[var(--secondary)]/[0.03]"
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
                          <td className="px-6 py-4 whitespace-nowrap">
                            {person.phone_number && (
                              <>
                                <a
                                  href={`tel:${person.phone_number}`}
                                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                                >
                                  <Phone className="w-5 h-5" />
                                  <span>{person.phone_number}</span>
                                </a>
                              </>
                            )}
                            {person.viber_number && (
                              <>
                                <a
                                  href={`viber://chat?number=${person.viber_number}`}
                                  className="flex items-center gap-2 text-purple-600 hover:text-purple-800"
                                >
                                  <MessageCircle className="w-5 h-5" />
                                  <span>{person.viber_number}</span>
                                </a>
                              </>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {formatHoursToHoursAndMinutes(
                              person.hour_patrolled,
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {formatHoursToHoursAndMinutes(person.man_hour)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {person.kilometer_patrolled?.toFixed(2) || "0.00"}{" "}
                            km
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
