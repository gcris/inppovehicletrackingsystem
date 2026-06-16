import React, { useState, useEffect } from "react";
import {
  supabase,
  Unit,
  MobilityAsset,
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
  PowerOff,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

export default function DashboardPage() {
  const { unitId, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    totalStrength: 0,
    activePersonnel: 0,
    ineffectivePersonnel: 0,
    offDutyPersonnel: 0,
    onDutyShiftPersonnel: 0,
    mobilePatrolling: "",
    tmrUPatrolling: "",
    footPatrolling: "",
    bikePatrolling: "",
    checkpoint: "",
    mobilePatrolVehicles: 0,
    tmrUPatrolVehicles: 0,
    bikePatrolVehicles: 0,
    recentLogs: [] as any[],
    schedules: [] as any[],
  });
  const [unitName, setUnitName] = useState("");

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
        .select("*, unit(*), schedule_assignments(personnel(*, rank(*)))")
        .eq("date", format(new Date(), "yyyy-MM-dd"));
      let logsQuery = supabase
        .from("vehicle_logs")
        .select("*, mobility_assets(unit_id, plate_number, vehicle_type)")
        .order("captured_at", { ascending: false })
        .limit(5);
      let vehiclesQuery = supabase
        .from("mobility_assets")
        .select("*, vehicle_type");
      let shiftAssignmentsQuery = supabase
        .from("shift_assignments")
        .select("personnel_id")
        .eq("duty_date", format(new Date(), "yyyy-MM-dd"));

      // Apply unit filtering for non-admin users
      if (!isAdmin && unitId) {
        personnelQuery = personnelQuery.eq("unit_id", unitId);
        schedulesQuery = schedulesQuery.eq("unit_id", unitId);
        // For logs, we need to filter by mobility asset's unit_id
        logsQuery = supabase
          .from("vehicle_logs")
          .select("*, mobility_assets(unit_id, plate_number, vehicle_type)")
          .order("captured_at", { ascending: false })
          .limit(5);
        vehiclesQuery = vehiclesQuery.eq("unit_id", unitId);
        shiftAssignmentsQuery = shiftAssignmentsQuery.eq("unit_id", unitId);

        const { data } = await supabase
          .from("unit")
          .select("unit_name")
          .eq("id", unitId)
          .single();

        if (data) {
          setUnitName(data.unit_name);
        }
      }

      const [
        personnelRes,
        schedulesRes,
        logsRes,
        vehiclesRes,
        shiftAssignmentsRes,
      ] = await Promise.all([
        personnelQuery,
        schedulesQuery,
        logsQuery,
        vehiclesQuery,
        shiftAssignmentsQuery,
      ]);

      if (personnelRes.error) throw personnelRes.error;
      if (shiftAssignmentsRes.error) throw shiftAssignmentsRes.error;

      if (personnelRes.data) {
        // Calculate personnel statistics
        const totalPersonnel = personnelRes.data.length;
        const activePersonnel = personnelRes.data.filter(
          (p) =>
            p.duty_status === "Active Duty" ||
            p.duty_status === "Detached Service",
        ).length;
        const ineffectivePersonnel = totalPersonnel - activePersonnel;

        // Calculate off duty personnel (Active Duty without shift assignment for today)
        const activeDutyPersonnel = personnelRes.data.filter(
          (p) => p.duty_status === "Active Duty",
        );

        let offDutyPersonnelCount = 0;
        let onDutyShiftPersonnelCount = 0;
        if (shiftAssignmentsRes.data) {
          const assignedPersonnelIds = new Set(
            shiftAssignmentsRes.data.map((a) => a.personnel_id),
          );
          onDutyShiftPersonnelCount = assignedPersonnelIds.size;
          offDutyPersonnelCount = activeDutyPersonnel.filter(
            (person) => !assignedPersonnelIds.has(person.id),
          ).length;
        } else {
          // If no shift assignments data, all active duty are off duty
          offDutyPersonnelCount = activeDutyPersonnel.length;
          onDutyShiftPersonnelCount = 0;
        }

        setData((prev) => ({
          ...prev,
          totalStrength: totalPersonnel,
          activePersonnel,
          ineffectivePersonnel,
          offDutyPersonnel: offDutyPersonnelCount,
          onDutyShiftPersonnel: onDutyShiftPersonnelCount,
          schedules: schedulesRes.data || [],
        }));
      }

      if (schedulesRes.data) {
        // Calculate patrol statistics based on patrol_schedule table
        const schedules = schedulesRes.data;

        // Calculate schedule counts
        const mobilePatrollingSchedules = schedules.filter(
          (s) => s.patrol_type === "Mobile Patrol",
        ).length;

        const tmrUPatrollingSchedules = schedules.filter(
          (s) => s.patrol_type === "TMRU Patrol",
        ).length;

        const checkpointSchedules = schedules.filter(
          (s) => s.patrol_type === "Checkpoint",
        ).length;

        // Calculate actual personnel counts for each patrol type
        const mobilePatrollingPersonnel = schedules
          .filter((s) => s.patrol_type === "Mobile Patrol")
          .reduce((total, schedule) => {
            return total + (schedule.schedule_assignments?.length || 0);
          }, 0);

        const tmrUPatrollingPersonnel = schedules
          .filter((s) => s.patrol_type === "TMRU Patrol")
          .reduce((total, schedule) => {
            return total + (schedule.schedule_assignments?.length || 0);
          }, 0);

        const footPatrollingPersonnel = schedules
          .filter((s) => s.patrol_type === "Foot Patrol")
          .reduce((total, schedule) => {
            return total + (schedule.schedule_assignments?.length || 0);
          }, 0);

        const bikePatrollingPersonnel = schedules
          .filter((s) => s.patrol_type === "Bike Patrol")
          .reduce((total, schedule) => {
            return total + (schedule.schedule_assignments?.length || 0);
          }, 0);

        const checkpointPersonnel = schedules
          .filter((s) => s.patrol_type === "Checkpoint")
          .reduce((total, schedule) => {
            return total + (schedule.schedule_assignments?.length || 0);
          }, 0);

        setData((prev) => ({
          ...prev,
          mobilePatrolling: `${mobilePatrollingSchedules} | ${mobilePatrollingPersonnel}`,
          tmrUPatrolling: `${tmrUPatrollingSchedules} | ${tmrUPatrollingPersonnel}`,
          footPatrolling: `${footPatrollingPersonnel}`,
          bikePatrolling: `${bikePatrollingPersonnel}`,
          checkpoint: `${checkpointSchedules} | ${checkpointPersonnel}`,
          schedules: schedulesRes.data || [],
        }));
      }

      if (logsRes.data) {
        // Filter logs to only include those from user's unit (for non-admin)
        let filteredLogs = logsRes.data;
        if (!isAdmin && unitId) {
          filteredLogs = logsRes.data.filter(
            (log) =>
              log.mobility_assets && log.mobility_assets.unit_id === unitId,
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
          (v) => v.vehicle_type === "Motorcycle",
        ).length;
        const bikePatrolVehicles = vehiclesRes.data.filter(
          (v) => v.vehicle_type === "Bike",
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
          <h1 className="text-2xl text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            {unitName} Dashboard
          </h1>
          <p className="text-slate-800 dark:text-slate-200 mt-1">
            Real-time situational awareness for {unitName}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2 transition-colors">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="text-slate-800 dark:text-slate-200">
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
          <div className="mb-4 flex items-center gap-3">
            <img
              src="/assets/total-strength.png"
              alt="Vehicle Statistics"
              className="w-8 h-8 object-contain"
            />

            <div>
              <h2 className="text-xl font-bold text-gray-800">Personnel</h2>
            </div>
          </div>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              <SummaryCard
                label="Total Strength"
                value={data.totalStrength.toString()}
              />
              <SummaryCard
                label="Actual Present"
                value={data.onDutyShiftPersonnel.toString()}
              />
              <SummaryCard
                label="Patrol Duty"
                value={data.activePersonnel.toString()}
              />
              <SummaryCard
                label="Off Duty"
                value={data.offDutyPersonnel.toString()}
              />
              <SummaryCard
                label="Ineffective Personnel"
                value={data.ineffectivePersonnel.toString()}
              />
            </div>

            <hr className="mt-4 border-gray-600" />
          </div>

          <div className="mb-4 flex items-center gap-3">
            <img
              src="/assets/patrol-schedule.png"
              alt="Vehicle Statistics"
              className="w-8 h-8 object-contain"
            />

            <div>
              <h2 className="text-xl font-bold text-gray-800">
                Patrolling Statistics
              </h2>
            </div>
          </div>

          {/* Patrol Statistics Cards */}
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <SummaryCard
                label="Mobile Patrolling"
                value={data.mobilePatrolling}
              />
              <SummaryCard
                label="TMRU Patrolling"
                value={data.tmrUPatrolling}
              />
              <SummaryCard
                label="Foot Patrolling"
                value={data.footPatrolling}
              />
              <SummaryCard
                label="Bike Patrolling"
                value={data.bikePatrolling}
              />
              <SummaryCard label="Checkpoint" value={data.checkpoint} />
            </div>
            <hr className="mt-4 border-gray-600" />
          </div>

          <div className="mb-4 flex items-center gap-3">
            <img
              src="/assets/mobility-assets.png"
              alt="Vehicle Statistics"
              className="w-8 h-8 object-contain"
            />

            <div>
              <h2 className="text-xl font-bold text-gray-800">
                Mobility Asset
              </h2>
            </div>
          </div>

          {/* Vehicle Statistics Cards */}
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
              <SummaryCard
                label="Mobile Patrol"
                value={data.mobilePatrolVehicles.toString()}
              />
              <SummaryCard
                label="TMRU"
                value={data.tmrUPatrolVehicles.toString()}
              />
              <SummaryCard
                label="Bike Patrol"
                value={data.bikePatrolVehicles.toString()}
              />
            </div>

            <hr className="mt-4 border-gray-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Vehicle Activity */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col transition-colors">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-blue-600" />
                  Recent Vehicle Movement
                </h3>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {data.recentLogs?.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-4 text-md">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center">
                        <Car className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-slate-200 transition-colors">
                          {log.mobility_assets?.plate_number}
                        </p>
                        <div className="flex items-center gap-2">
                          <span>{log.speed} km/h</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-700 dark:text-slate-300">
                        {format(new Date(log.captured_at), "HH:mm")}H
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Current Deployment List */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col transition-colors">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Today's Patrol Schedule
                </h3>
              </div>
              <div className="p-4 space-y-4">
                {data.schedules?.slice(0, 5).map((sched) => (
                  <div
                    key={sched.id}
                    className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800"
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span className="text-blue-600 leading-none mb-1">
                        {sched.unit?.unit_name}
                        {" | "}
                        {sched.sector}
                        {" | "}
                        {sched.patrol_type}
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 leading-none">
                        {sched.time_from.slice(0, 5)} -{" "}
                        {sched.time_to.slice(0, 5)}
                      </span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 leading-tight">
                      {/* Display personnel names from junction table */}
                      {sched.schedule_assignments?.length > 0
                        ? [...sched.schedule_assignments]
                            .sort((a, b) => {
                              const rankA =
                                a.personnel?.rank?.level ?? -Infinity;
                              const rankB =
                                b.personnel?.rank?.level ?? -Infinity;
                              return rankB - rankA; // descending
                            })
                            .map(
                              (assign: {
                                personnel: {
                                  rank?: { rank_name: string };
                                  fullname: string;
                                };
                              }) =>
                                `${assign.personnel.rank?.rank_name ?? "No Rank"} ${assign.personnel?.fullname}`.trim(),
                            )
                            .filter(
                              (name: string | undefined): name is string =>
                                name !== undefined,
                            )
                            .join(", ")
                        : // Fallback to old personnel data
                          sched.personnel?.fullname || "Unassigned"}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-800 dark:text-slate-200 uppercase">
                        Number of personnel:{" "}
                        {sched.schedule_assignments?.length}
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
                  className="block text-center  font-black text-blue-600 pt-2 hover:underline"
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-colors w-full">
      {/* Middle: Content Block (Stretches to fill space) */}
      <div className="flex-1 min-w-0">
        <p className="mb-0.5">{label}</p>
        <h3 className="text-5xl font-bold text-slate-900 dark:text-white leading-tight">
          {value}
        </h3>
      </div>
    </div>
  );
}
