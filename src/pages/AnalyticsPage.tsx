import React, { useState, useEffect } from "react";
import {
  supabase,
  MobilityAsset,
  Unit,
  VehicleLog,
  PatrolSchedule,
} from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";
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
} from "lucide-react";
import { format, subDays, formatDistanceToNow } from "date-fns";

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

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activities, setActivities] = useState<any[]>([]);
  const [personnelData, setPersonnelData] = useState<any[]>([]);
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
      const rangeStart = `${selectedDateStr}T00:00:00.000Z`;
      const rangeEnd = `${selectedDateStr}T23:59:59.999Z`;

      // Fetch personnel with their ranks and contact info
      const { data: personnelData, error: personnelError } = await supabase
        .from("personnel")
        .select(
          `
          id,
          badge_number,
          fullname,
          rank_id,
          rank:rank_id(rank_name),
          unit_id,
          phone_number,
          email
        `,
        )
        .eq("is_approved", true);

      if (personnelError) throw personnelError;

      // Fetch shift assignments for the date range to calculate hours
      const { data: shiftAssignments, error: shiftError } = await supabase
        .from("shift_assignments")
        .select(
          `
          personnel_id,
          duty_date,
          duty_shift:shift_id(
            time_start,
            time_end
          )
        `,
        )
        .gte("duty_date", rangeStart.split("T")[0])
        .lte("duty_date", rangeEnd.split("T")[0]);

      if (shiftError) throw shiftError;

      // Fetch vehicle logs for distance calculation
      const { data: vehicleLogs, error: logsError } = await supabase
        .from("vehicle_logs")
        .select(
          `
          vehicle_id,
          latitude,
          longitude,
          captured_at
        `,
        )
        .gte("captured_at", rangeStart)
        .lte("captured_at", rangeEnd)
        .order("captured_at", { ascending: true });

      if (logsError) throw logsError;

      // Fetch mobility assets to link vehicles to personnel
      const { data: mobilityAssets, error: assetsError } = await supabase.from(
        "mobility_assets",
      ).select(`
          id,
          personnel_id
        `);

      if (assetsError) throw assetsError;

      // Process data to calculate metrics per personnel
      const processedPersonnel = personnelData.map((person) => {
        // Calculate hour patrolled and man-hour from shift assignments
        const personShifts = shiftAssignments.filter(
          (sa) => sa.personnel_id === person.id,
        );

        let hourPatrolled = 0;
        personShifts.forEach((shift) => {
          // Safely access nested duty_shift properties (it's an array from Supabase)
          const dutyShiftArray = shift.duty_shift;
          if (
            dutyShiftArray &&
            Array.isArray(dutyShiftArray) &&
            dutyShiftArray.length > 0
          ) {
            const dutyShift = dutyShiftArray[0];
            if (dutyShift.time_start && dutyShift.time_end) {
              const [startH, startM] = dutyShift.time_start
                .split(":")
                .map(Number);
              const [endH, endM] = dutyShift.time_end.split(":").map(Number);
              let diffMinutes = endH * 60 + endM - (startH * 60 + startM);
              if (diffMinutes < 0) diffMinutes += 24 * 60; // Overnight shift
              hourPatrolled += diffMinutes / 60;
            }
          }
        });

        // Calculate kilometer patrolled from vehicle logs
        let kilometerPatrolled = 0;

        // Create a map of vehicle_id to personnel_id from mobility assets
        const vehicleToPersonnelMap: Record<string, any[]> = {};
        mobilityAssets.forEach((asset) => {
          if (asset.personnel_id) {
            vehicleToPersonnelMap[asset.id] = asset.personnel_id;
          }
        });

        // Group logs by vehicle and calculate distances
        const logsByVehicle: Record<string, any[]> = {};
        vehicleLogs.forEach((log) => {
          if (!logsByVehicle[log.vehicle_id]) {
            logsByVehicle[log.vehicle_id] = [];
          }
          logsByVehicle[log.vehicle_id].push(log);
        });

        // Calculate distance for each vehicle's logs
        Object.keys(logsByVehicle).forEach((vehicleId) => {
          const vehicleLogs = logsByVehicle[vehicleId] || [];
          const personnelId = vehicleToPersonnelMap[vehicleId];

          if (personnelId === person.id && vehicleLogs.length > 1) {
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

        return {
          ...person,
          hour_patrolled: Number(hourPatrolled.toFixed(1)),
          man_hour: Number(hourPatrolled.toFixed(1)), // Assuming man-hour equals hour patrolled
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

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch analytics data for the selected date only
      const selectedDateStr = selectedDate;
      const rangeStart = `${selectedDateStr}T00:00:00.000Z`;
      const rangeEnd = `${selectedDateStr}T23:59:59.999Z`;

      // Build queries with unit filtering for non-admin users
      let unitsQuery = supabase.from("unit").select("*");
      let vehiclesQuery = supabase.from("mobility_assets").select("*");
      let scheduleQuery = supabase
        .from("patrol_schedule")
        .select("*, unit(*), schedule_assignments(personnel(*))")
        .gte("date", rangeStart.split("T")[0])
        .lte("date", rangeStart.split("T")[0]);

      // Apply unit filtering for non-admin users
      // Explicitly check for null/undefined to handle unitId = 0 case
      if (!isAdminSafe && unitIdSafe !== null) {
        unitsQuery = unitsQuery.eq("id", unitIdSafe);
        vehiclesQuery = vehiclesQuery.eq("unit_id", unitIdSafe);
        // For logs, we need to filter by mobility asset's unit_id
        // For schedules, filter by unit_id
        scheduleQuery = scheduleQuery.eq("unit_id", unitIdSafe);
      }

      // Always build logsQuery with the base conditions
      let logsQuery = supabase
        .from("vehicle_logs")
        .select("*, mobility_assets(unit_id)")
        .gte("captured_at", rangeStart)
        .lte("captured_at", rangeEnd);

      const [unitsRes, logsRes, vehiclesRes, scheduleRes] = await Promise.all([
        unitsQuery,
        logsQuery,
        vehiclesQuery,
        scheduleQuery,
      ]);

      if (unitsRes.error) throw unitsRes.error;
      if (logsRes.error) throw logsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (scheduleRes.error) throw scheduleRes.error;

      // Filter logs to only include those from user's unit (for non-admin)
      let filteredLogsData = logsRes.data;
      // Explicitly check for null/undefined to handle unitId = 0 case
      if (!isAdminSafe && unitIdSafe !== null && logsRes.data) {
        filteredLogsData = logsRes.data.filter(
          (log) =>
            log.mobility_assets && log.mobility_assets.unit_id === unitIdSafe,
        );
      }

      // 2. Average Speed, Signals, & Active Alerts
      let signalLogs: any[] = [];
      let avgSpeed = 0;
      let activeAlerts = 0;
      let avgSignal = 84;

      const sortedLogData = filteredLogsData
        ? [...filteredLogsData].sort(
            (a, b) =>
              new Date(a.captured_at).getTime() -
              new Date(b.captured_at).getTime(),
          )
        : [];

      if (sortedLogData.length > 0) {
        const avgSpeedCalc =
          sortedLogData.reduce((a, b) => a + Number(b.speed || 0), 0) /
          sortedLogData.length;
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

      // 3. Patrol Hours based on schedule date and time (for selected date only)
      const daySchedules = (scheduleRes.data || []).filter(
        (s) => s.date === selectedDate,
      );
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
          day: format(new Date(selectedDate), "EEE, MMM d"),
          date: selectedDate,
          hours: Number(hours.toFixed(1)),
        },
      ];
      const weeklyHours = Math.round(hours);

      // Calculate total hour patrolled (sum of all patrol hours)
      const totalHourPatrolled = hours;

      // Calculate total man-hour (assuming same as hour patrolled for now)
      const totalManHour = totalHourPatrolled;

      // Calculate total kilometer patrolled from vehicle logs
      let totalKilometerPatrolled = 0;
      if (sortedLogData.length > 1) {
        // Sort by captured_at to ensure chronological order
        const sortedLogsByTime = [...sortedLogData].sort(
          (a, b) =>
            new Date(a.captured_at).getTime() -
            new Date(b.captured_at).getTime(),
        );

        // Calculate distance between consecutive points (Haversine formula)
        for (let i = 1; i < sortedLogsByTime.length; i++) {
          const prev = sortedLogsByTime[i - 1];
          const curr = sortedLogsByTime[i];

          // Only calculate distance if it's from the same vehicle
          if (prev.vehicle_id === curr.vehicle_id) {
            const distance = calculateDistance(
              prev.latitude,
              prev.longitude,
              curr.latitude,
              curr.longitude,
            );
            totalKilometerPatrolled += distance;
          }
        }
      }

      setStats({
        patrolHours,
        signalLogs,
        avgSpeed,
        avgSignal: sortedLogData.length > 0 ? avgSignal : ("--" as any),
        weeklyHours,
        activeAlerts,
        totalHourPatrolled,
        totalManHour,
        totalKilometerPatrolled,
      });

      // 4. Generate recent activities based on actual data
      const recentActivities: any[] = [];
      const recentSchedules = (scheduleRes.data || []).sort(
        (a, b) =>
          new Date(`${b.date}T${b.time_from || "00:00"}`).getTime() -
          new Date(`${a.date}T${a.time_from || "00:00"}`).getTime(),
      );

      recentSchedules.slice(0, 5).forEach((s) => {
        const unitName = s.unit?.unit_name || "Unknown Unit";
        const dObj = new Date(`${s.date}T${s.time_from || "00:00"}`);
        recentActivities.push({
          title: `Schedule Assigned - ${unitName}`,
          time:
            dObj.getTime() < Date.now()
              ? formatDistanceToNow(dObj, { addSuffix: true })
              : `Planned for ${format(dObj, "MMM d, p")}`,
          type: "schedule",
          dateObj: dObj,
        });
      });

      if (sortedLogData.length > 0) {
        // High speed
        const speedAlerts = sortedLogData.filter((l) => l.speed > 80);
        const speedByVehicle = Array.from(
          new Set(speedAlerts.map((a) => a.vehicle_id)),
        );
        speedByVehicle.slice(0, 3).forEach((vId) => {
          const logsForVehicle = speedAlerts
            .filter((a) => a.vehicle_id === vId)
            .sort(
              (a, b) =>
                new Date(b.captured_at).getTime() -
                new Date(a.captured_at).getTime(),
            );
          const log = logsForVehicle[0]; // most recent
          const vehicleInfo = vehiclesRes.data?.find(
            (v) => v.id === log.vehicle_id,
          );
          const dObj = new Date(log.captured_at);
          recentActivities.push({
            title: `High Speed Alert: Mobility Asset ${vehicleInfo?.plate_number || "Unknown"} (${log.speed} km/h)`,
            time: formatDistanceToNow(dObj, { addSuffix: true }),
            type: "alert",
            dateObj: dObj,
          });
        });

        // Low signal
        const signalAlerts = sortedLogData.filter((l) => l.network_signal < 20);
        const signalByVehicle = Array.from(
          new Set(signalAlerts.map((a) => a.vehicle_id)),
        );
        signalByVehicle.slice(0, 3).forEach((vId) => {
          const logsForVehicle = signalAlerts
            .filter((a) => a.vehicle_id === vId)
            .sort(
              (a, b) =>
                new Date(b.captured_at).getTime() -
                new Date(a.captured_at).getTime(),
            );
          const log = logsForVehicle[0]; // most recent
          const vehicleInfo = vehiclesRes.data?.find(
            (v) => v.id === log.vehicle_id,
          );
          const dObj = new Date(log.captured_at);
          recentActivities.push({
            title: `Signal Drop: Mobility Asset ${vehicleInfo?.plate_number || "Unknown"} (${Math.round(log.network_signal)}%)`,
            time: formatDistanceToNow(dObj, { addSuffix: true }),
            type: "alert",
            dateObj: dObj,
          });
        });
      }

      recentActivities.sort(
        (a, b) => b.dateObj.getTime() - a.dateObj.getTime(),
      );

      if (recentActivities.length === 0) {
        recentActivities.push({
          title: "System Online & Syncing Data",
          time: "Just now",
          type: "sync",
          dateObj: new Date(),
        });
      }

      setActivities(recentActivities.slice(0, 7));
    } catch (err: any) {
      console.error("Error fetching analytics:", err);
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
          <h1 className="text-3xl font-black text-[var(--text)] flex items-center gap-4">
            <BarChart3 className="w-7 h-7 text-[var(--accent)]" />
            Performance Analytics
          </h1>
          <p className="text-[16px] text-[var(--text)]/[0.9] font-bold uppercase tracking-wider mt-2">
            Deep dive into unit efficiency and fleet health
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-[var(--primary)]/[0.4] dark:bg-[var(--primary)]/[0.3] border border-[var(--secondary)]/[0.4] dark:border-[var(--secondary)]/[0.3] rounded-2xl p-2 shadow-[var(--accent)]/[0.1] dark:shadow-[var(--accent)]/[0.05] transition-colors duration-200 backdrop-blur-sm">
            <input
              type="date"
              defaultValue={new Date().toISOString().split('T')[0]}
              className="ml-2 block w-[200px] rounded-md border-[var(--secondary)]/[0.4] dark:border-[var(--secondary)]/[0.3] bg-[var(--primary)]/[0.9] px-3 py-2 text-[var(--text)] ring-1 ring-inset ring-[var(--primary)]/[0.25] focus:ring-2 focus-ring-[var(--accent)]/[0.5] focus:ring-offset-[var(--accent)]/[0.1] sm:text-sm"
              onChange={(e) => {
                setSelectedDate(e.target.value);
              }}
            />
          </div>
          <button className="flex items-center gap-3 px-5 py-3 bg-[var(--accent)]/[0.25] text-[var(--text)] font-bold text-[16px] uppercase tracking-tighter hover:bg-[var(--accent)]/[0.35] transition-colors duration-200 focus:ring-2 focus-ring-[var(--accent)]/[0.4] focus:ring-offset-[var(--accent)]/[0.1]">
            <Download className="w-5 h-5" />
            Export
          </button>
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
            <div className="bg-[var(--primary)]/[0.92] dark:bg-[var(--primary)]/[0.85] p-8 rounded-2xl border border-[var(--secondary)]/[0.35] dark:border-[var(--secondary)]/[0.25] shadow-[var(--accent)]/[0.15] dark:shadow-[var(--accent)]/[0.08] transition-colors duration-300 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="p-5 bg-[var(--secondary)]/[0.25] rounded-xl border border-[var(--secondary)]/[0.25]">
                  <TrendingUp className="w-6 h-6 text-[var(--accent)]" />
                </div>
                <div>
                  <p className="text-[12px] font-black text-[var(--text)]/[0.9] uppercase tracking-widest mb-2">
                    Total Hour Patrolled
                  </p>
                  <p className="text-4xl font-black text-[var(--text)] tracking-tighter">
                    {stats.totalHourPatrolled}h
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-[var(--primary)]/[0.92] dark:bg-[var(--primary)]/[0.85] p-8 rounded-2xl border border-[var(--secondary)]/[0.35] dark:border-[var(--secondary)]/[0.25] shadow-[var(--accent)]/[0.15] dark:shadow-[var(--accent)]/[0.08] transition-colors duration-300 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="p-5 bg-[var(--secondary)]/[0.25] rounded-xl border border-[var(--secondary)]/[0.25]">
                  <Clock className="w-6 h-6 text-[var(--accent)]" />
                </div>
                <div>
                  <p className="text-[12px] font-black text-[var(--text)]/[0.9] uppercase tracking-widest mb-2">
                    Total Man-Hour
                  </p>
                  <p className="text-4xl font-black text-[var(--text)] tracking-tighter">
                    {stats.totalManHour}h
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-[var(--primary)]/[0.92] dark:bg-[var(--primary)]/[0.85] p-8 rounded-2xl border border-[var(--secondary)]/[0.35] dark:border-[var(--secondary)]/[0.25] shadow-[var(--accent)]/[0.15] dark:shadow-[var(--accent)]/[0.08] transition-colors duration-300 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="p-5 bg-[var(--secondary)]/[0.25] rounded-xl border border-[var(--secondary)]/[0.25]">
                  <Zap className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-[12px] font-black text-[var(--text)]/[0.9] uppercase tracking-widest mb-2">
                    Total Kilometer Patrolled
                  </p>
                  <p className="text-4xl font-black text-[var(--text)] tracking-tighter">
                    {stats.totalKilometerPatrolled.toFixed(2)} km
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-1 gap-8">
            {/* Personnel List */}
            <div className="bg-[var(--primary)]/[0.92] dark:bg-[var(--primary)]/[0.85] p-8 rounded-2xl border border-[var(--secondary)]/[0.35] dark:border-[var(--secondary)]/[0.25] shadow-[var(--accent)]/[0.15] dark:shadow-[var(--accent)]/[0.08] transition-colors duration-300 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-black text-[var(--text)]/[0.9] uppercase tracking-widest text-[16px] flex items-center gap-4">
                  <FileText className="w-5 h-5 text-[var(--accent)]" />
                  Personnel Patrol Report
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[var(--secondary)]/[0.2]">
                  <thead className="bg-[var(--secondary)]/[0.1]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text)]/[0.6] uppercase tracking-wider">
                        Badge #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text)]/[0.6] uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text)]/[0.6] uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text)]/[0.6] uppercase tracking-wider">
                        Contact Info
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text)]/[0.6] uppercase tracking-wider">
                        Hour Patrolled
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text)]/[0.6] uppercase tracking-wider">
                        Man-Hour
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text)]/[0.6] uppercase tracking-wider">
                        Kilometer Patrolled
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--secondary)]/[0.2]">
                    {personnelData.length > 0 ? (
                      personnelData.map((person, index) => (
                        <tr
                          key={index}
                          className="bg-[var(--primary)]/[0.02] hover:bg-[var(--secondary)]/[0.03]"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--text)]">
                            {person.badge_number || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text)]">
                            {person.rank?.rank_name || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--text)]">
                            {person.fullname || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text)]">
                            {person.phone_number || person.email || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text)]">
                            {person.hour_patrolled?.toFixed(1) || "0.0"}h
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text)]">
                            {person.man_hour?.toFixed(1) || "0.0"}h
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text)]">
                            {person.kilometer_patrolled?.toFixed(2) || "0.00"}{" "}
                            km
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-6 py-10 text-center text-[var(--text)]/[0.6] colspan=7">
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

function ActivityRow({
  title,
  time,
  type,
}: {
  title: string;
  time: string;
  type: string;
}) {
  const getIcon = () => {
    switch (type) {
      case "alert":
        return <AlertCircle className="w-5 h-5" />;
      case "sync":
        return <Clock className="w-5 h-5" />;
      case "schedule":
        return <FileText className="w-5 h-5" />;
      default:
        return <Zap className="w-5 h-5" />;
    }
  };

  return (
    <div className="flex items-center justify-between py-4 border-b border-[var(--secondary)]/[0.3] dark:border-[var(--secondary)]/[0.2] last:border-0 hover:bg-[var(--secondary)]/[0.3] dark:hover:bg-[var(--secondary)]/[0.2] px-3 rounded-lg transition-colors duration-200 cursor-default -mx-3">
      <div className="flex items-center gap-4">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            type === "alert"
              ? "bg-red-50/[0.2] dark:bg-red-900/[0.2] text-red-500 dark:text-red-400"
              : type === "sync"
                ? "bg-emerald-50/[0.2] dark:bg-emerald-900/[0.2] text-emerald-500 dark:text-emerald-400"
                : type === "schedule"
                  ? "bg-blue-50/[0.2] dark:bg-blue-900/[0.2] text-blue-500 dark:text-blue-400"
                  : "bg-[var(--secondary)]/[0.3] dark:bg-[var(--secondary)]/[0.2] text-[var(--text)]/[0.8] dark:text-[var(--text)]/[0.6]"
          }`}
        >
          {getIcon()}
        </div>
        <div>
          <p className="text-[12px] font-bold text-[var(--text)]/[0.9] line-clamp-1">
            {title}
          </p>
          <p className="text-[14px] text-[var(--text)]/[0.9] font-bold">
            {time}
          </p>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-[var(--text)]/[0.8] shrink-0 ml-3" />
    </div>
  );
}

function ChevronRight(props: any) {
  return (
    <svg
      {...props}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
