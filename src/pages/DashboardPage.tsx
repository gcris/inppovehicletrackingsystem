import React, { useState, useEffect } from "react";
import {
  supabase,
  Vehicle,
  VehicleLog,
  Personnel,
  PatrolSchedule,
} from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";
import {
  Activity,
  Map as MapIcon,
  Shield,
  Car,
  Users,
  AlertCircle,
  ArrowUpRight,
  Navigation,
  Clock,
  Radio,
  MapPin,
  Zap,
  Bike,
  CheckCircle,
  Motorbike,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

export default function DashboardPage() {
  const { unitId, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    totalPersonnel: 0,
    activePersonnel: 0,
    ineffectivePersonnel: 0,
    offDutyPersonnel: 0,
    mobilePatrolling: 0,
    tmrUPatrolling: 0,
    footPatrolling: 0,
    bikePatrolling: 0,
    checkpoint: 0,
    mobilePatrolVehicles: 0,
    tmrUPatrolVehicles: 0,
    bikePatrolVehicles: 0,
    recentLogs: [] as any[],
    schedules: [] as any[],
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Build queries with unit filtering for non-admin users
      let personnelQuery = supabase.from("personnel").select("*");
      let schedulesQuery = supabase
        .from("patrol_schedule")
        .select("*, unit(*), schedule_assignments(personnel(*))")
        .eq("date", format(new Date(), "yyyy-MM-dd"));
      let logsQuery = supabase
        .from("vehicle_logs")
        .select("*, vehicles(unit_id, vehicle_type)")
        .order("captured_at", { ascending: false })
        .limit(5);
      let vehiclesQuery = supabase.from("vehicles").select("*, vehicle_type");

      // Apply unit filtering for non-admin users
      if (!isAdmin && unitId) {
        personnelQuery = personnelQuery.eq("unit_id", unitId);
        schedulesQuery = schedulesQuery.eq("unit_id", unitId);
        // For logs, we need to filter by vehicle's unit_id
        logsQuery = supabase
          .from("vehicle_logs")
          .select("*, vehicles(unit_id, vehicle_type)")
          .order("captured_at", { ascending: false })
          .limit(5);
        vehiclesQuery = vehiclesQuery.eq("unit_id", unitId);
      }

      const [personnelRes, schedulesRes, logsRes, vehiclesRes] =
        await Promise.all([
          personnelQuery,
          schedulesQuery,
          logsQuery,
          vehiclesQuery,
        ]);

      if (personnelRes.error) throw personnelRes.error;

      if (personnelRes.data) {
        // Calculate personnel statistics
        const totalPersonnel = personnelRes.data.length;
        const activePersonnel = personnelRes.data.filter(
          (p) =>
            p.duty_status === "Active Duty" ||
            p.duty_status === "Detached Service",
        ).length;
        const ineffectivePersonnel = totalPersonnel - activePersonnel;

        // Calculate off duty personnel (Active Duty without schedule for today)
        const activeDutyPersonnel = personnelRes.data.filter(
          (p) => p.duty_status === "Active Duty",
        );

        let offDutyPersonnelCount = 0;
        if (schedulesRes.data) {
          const schedules = schedulesRes.data;
          const personnelWithSchedule = new Set();
          schedules.forEach((schedule) => {
            if (schedule.schedule_assignments) {
              schedule.schedule_assignments.forEach((assignment) => {
                personnelWithSchedule.add(assignment.personnel_id);
              });
            }
          });

          offDutyPersonnelCount = activeDutyPersonnel.filter(
            (person) => !personnelWithSchedule.has(person.id),
          ).length;
        } else {
          // If no schedules data, all active duty are off duty
          offDutyPersonnelCount = activeDutyPersonnel.length;
        }

        setData((prev) => ({
          ...prev,
          totalPersonnel,
          activePersonnel,
          ineffectivePersonnel,
          offDutyPersonnel: offDutyPersonnelCount,
          schedules: schedulesRes.data || [],
        }));
      }

      if (schedulesRes.data) {
        // Calculate patrol statistics based on patrol_schedule table
        const schedules = schedulesRes.data;

        const mobilePatrolling = schedules.filter(
          (s) => s.patrol_type === "Mobile",
        ).length;

        const tmrUPatrolling = schedules.filter(
          (s) => s.sector === "TMRU" || s.sector === "Traffic",
        ).length;

        const footPatrolling = schedules.filter(
          (s) => s.patrol_type === "Foot",
        ).length;

        const bikePatrolling = schedules.filter(
          (s) => s.sector === "Bike" || s.sector === "Cycling",
        ).length;

        const checkpoint = schedules.filter(
          (s) => s.sector === "Checkpoint" || s.sector === "Traffic Control",
        ).length;

        setData((prev) => ({
          ...prev,
          mobilePatrolling,
          tmrUPatrolling,
          footPatrolling,
          bikePatrolling,
          checkpoint,
          schedules: schedulesRes.data || [],
        }));
      }

      if (logsRes.data) {
        // Filter logs to only include those from user's unit (for non-admin)
        let filteredLogs = logsRes.data;
        if (!isAdmin && unitId) {
          filteredLogs = logsRes.data.filter(
            (log) => log.vehicles && log.vehicles.unit_id === unitId,
          );
        }
        setData((prev) => ({
          ...prev,
          recentLogs: filteredLogs || [],
        }));
      }

      if (vehiclesRes.data) {
        // Calculate vehicle type statistics
        const mobilePatrolVehicles = vehiclesRes.data.filter(
          (v) => v.vehicle_type === "Mobile Patrol",
        ).length;
        const tmrUPatrolVehicles = vehiclesRes.data.filter(
          (v) => v.vehicle_type === "TMRU",
        ).length;
        const bikePatrolVehicles = vehiclesRes.data.filter(
          (v) => v.vehicle_type === "Bike Patrol",
        ).length;

        setData((prev) => ({
          ...prev,
          mobilePatrolVehicles,
          tmrUPatrolVehicles,
          bikePatrolVehicles,
        }));
      }
    } catch (err: any) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Command Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">
            Real-time situational awareness for INPPO Provincial Command
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2 transition-colors">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {format(new Date(), "HH:mm")} • {format(new Date(), "MMM dd, yyyy")}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="flex-1 space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <SummaryCard
                label="Total Personnel"
                value={data.totalPersonnel}
                icon={<Users className="w-5 h-5 text-blue-600" />}
                sub="All police personnel"
              />
              <SummaryCard
                label="Active Personnel"
                value={data.activePersonnel}
                icon={<Activity className="w-5 h-5 text-green-600" />}
                sub="Currently on duty"
              />
              <SummaryCard
                label="Ineffective Personnel"
                value={data.ineffectivePersonnel}
                icon={<AlertCircle className="w-5 h-5 text-amber-500" />}
                sub="All leaves, NDS, Suspended, AWOL, etc."
              />
              <SummaryCard
                label="Off Duty"
                value={data.offDutyPersonnel}
                icon={<AlertCircle className="w-5 h-5 text-amber-500" />}
                sub="Active Duty"
              />
              <SummaryCard
                label="Mobile Patrol"
                value={data.mobilePatrolVehicles}
                icon={<Car className="w-5 h-5 text-blue-600" />}
                sub="Number of Mobiles"
              />
              <SummaryCard
                label="TMRU"
                value={data.tmrUPatrolVehicles}
                icon={<Motorbike className="w-5 h-5 text-purple-600" />}
                sub="Number of TMRUs"
              />
              <SummaryCard
                label="Bike Patrol"
                value={data.bikePatrolVehicles}
                icon={<Bike className="w-5 h-5 text-orange-500" />}
                sub="Number of Bikes"
              />
            </div>
          </div>

          {/* Patrol Statistics Cards */}
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <SummaryCard
                label="Mobile Patrolling"
                value={data.mobilePatrolling}
                icon={<Car className="w-5 h-5 text-blue-600" />}
                sub="Personnel on mobile patrol"
              />
              <SummaryCard
                label="TMRU Patrolling"
                value={data.tmrUPatrolling}
                icon={<Motorbike className="w-5 h-5 text-purple-600" />}
                sub="Personnel in TMRU"
              />
              <SummaryCard
                label="Foot Patrolling"
                value={data.footPatrolling}
                icon={<Users className="w-5 h-5 text-green-600" />}
                sub="Personnel on foot patrol"
              />
              <SummaryCard
                label="Bike Patrolling"
                value={data.bikePatrolling}
                icon={<Bike className="w-5 h-5 text-orange-500" />}
                sub="Personnel on bike patrol"
              />
              <SummaryCard
                label="Checkpoint"
                value={data.checkpoint}
                icon={<Zap className="w-5 h-5 text-yellow-500" />}
                sub="Personnel at checkpoints"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Vehicle Activity */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col transition-colors">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest text-[10px] flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-blue-600" />
                  Recent Telemetry Updates
                </h3>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {data.recentLogs?.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          log.vehicles?.load_status === "Expired"
                            ? "bg-amber-50 dark:bg-amber-900/20 text-amber-500"
                            : "bg-slate-50 dark:bg-slate-800 text-slate-500"
                        }`}
                      >
                        <Car className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                          {log.vehicles?.plate_number}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">
                          <span className="text-blue-600">
                            {log.speed} km/h
                          </span>
                          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                          <span>Signal: {log.network_signal}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {format(new Date(log.captured_at), "HH:mm:ss")}
                      </p>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase">
                        Received
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Current Deployment List */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col transition-colors">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest text-[10px] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Active Assignments
                </h3>
              </div>
              <div className="p-4 space-y-4">
                {data.schedules?.slice(0, 5).map((sched) => (
                  <div
                    key={sched.id}
                    className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">
                        {sched.unit?.unit_name}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase leading-none">
                        {sched.time_from.slice(0, 5)} -{" "}
                        {sched.time_to.slice(0, 5)}
                      </span>
                    </div>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-200 leading-tight">
                      {/* Display personnel names from junction table */}
                      {sched.schedule_assignments?.length > 0
                        ? sched.schedule_assignments
                            .map((assign) => assign.personnel?.fullname)
                            .filter(
                              (name): name is string => name !== undefined,
                            )
                            .join(", ")
                        : // Fallback to old personnel data
                          sched.personnel?.fullname || "Unassigned"}
                    </p>
                    <div className="flex items-center gap-2">
                      <Radio className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                        {sched.sector}
                      </span>
                    </div>
                  </div>
                ))}
                {data.schedules.length === 0 && (
                  <p className="text-xs font-bold text-slate-400 text-center py-10">
                    No active assignments
                  </p>
                )}
                <Link
                  to="/schedule"
                  className="block text-center text-[10px] font-black text-blue-600 uppercase tracking-widest pt-2 hover:underline"
                >
                  View Full Schedule
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  status,
  sub,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  status?: "success" | "danger";
  sub: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4 transition-colors">
      <div className="flex items-center justify-between">
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
          {icon}
        </div>
        <div
          className={`w-2 h-2 rounded-full ${
            status === "danger" && value > 0
              ? "bg-red-500 animate-pulse"
              : status === "success"
                ? "bg-green-500"
                : "bg-slate-200 dark:bg-slate-700"
          }`}
        ></div>
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
          {label}
        </p>
        <h3
          className={`text-3xl font-black tracking-tighter ${status === "success" ? "text-green-600" : status === "danger" && value > 0 ? "text-red-500" : "text-slate-900 dark:text-white"}`}
        >
          {value}
        </h3>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-1">
          {sub}
        </p>
      </div>
    </div>
  );
}
