import React, { useState, useEffect } from "react";
import {
  supabase,
  Unit,
  MobilityAsset,
  PatrolLog,
  Personnel,
  PatrolSchedule,
  Calendar,
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
  Calendar as CalendarIcon,
  Building,
} from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { Link } from "react-router-dom";

export default function DashboardPage() {
  const { unitId, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    totalStrength: 0,
    activePersonnel: 0,
    ineffectivePersonnel: 0,
    offDutyPersonnel: 0,
    onPatrolDutyPersonnel: 0,
    onOfficeDutyPersonnel: 0,
    mobilePatrolling: "",
    tmrUPatrolling: "",
    footPatrolling: "",
    bikePatrolling: "",
    checkpoint: "",
    seabornePatrolling: "",
    simex: "",
    mobilePatrolVehicles: 0,
    tmrUPatrolVehicles: 0,
    bikePatrolVehicles: 0,
    atvPatrolVehicles: 0,
    rescueBoatPatrolVehicles: 0,
    recentLogs: [] as any[],
    schedules: [] as any[],
  });
  const [calendarEvents, setCalendarEvents] = useState<Calendar[]>([]);
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
        .from("patrol_logs")
        .select("*, mobility_assets(unit_id, plate_number, vehicle_type)")
        .order("captured_at", { ascending: false })
        .limit(5);
      let vehiclesQuery = supabase
        .from("mobility_assets")
        .select("*, vehicle_type");

      // Apply unit filtering for non-admin users
      if (!isAdmin && unitId) {
        personnelQuery = personnelQuery.eq("unit_id", unitId);
        schedulesQuery = schedulesQuery.eq("unit_id", unitId);
        // For logs, we need to filter by mobility asset's unit_id
        logsQuery = supabase
          .from("patrol_logs")
          .select("*, mobility_assets(unit_id, plate_number, vehicle_type)")
          .order("captured_at", { ascending: false })
          .limit(5);
        vehiclesQuery = vehiclesQuery.eq("unit_id", unitId);

        const { data } = await supabase
          .from("unit")
          .select("unit_name")
          .eq("id", unitId)
          .single();

        if (data) {
          setUnitName(data.unit_name);
        }
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

        let onPatrolDutyPersonnelCount = 0;
        let onOfficeDutyPersonnelCount = 0;

        if (schedulesRes.data) {
          onPatrolDutyPersonnelCount = schedulesRes.data
            .filter((s) => s.patrol_type !== "Remain in Office")
            .reduce((total, schedule) => {
              return total + (schedule.schedule_assignments?.length || 0);
            }, 0);

          onOfficeDutyPersonnelCount = schedulesRes.data
            .filter((s) => s.patrol_type === "Remain in Office")
            .reduce((total, schedule) => {
              return total + (schedule.schedule_assignments?.length || 0);
            }, 0);
        }

        const offDutyPersonnelCount =
          activePersonnel -
          (onOfficeDutyPersonnelCount + onPatrolDutyPersonnelCount);

        setData((prev) => ({
          ...prev,
          totalStrength: totalPersonnel,
          activePersonnel,
          ineffectivePersonnel,
          offDutyPersonnel: offDutyPersonnelCount,
          onPatrolDutyPersonnel: onPatrolDutyPersonnelCount,
          onOfficeDutyPersonnel: onOfficeDutyPersonnelCount,
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

        const seabornePatrollingPersonnel = schedules
          .filter((s) => s.patrol_type === "Seaborne Patrol")
          .reduce((total, schedule) => {
            return total + (schedule.schedule_assignments?.length || 0);
          }, 0);

        const checkpointPersonnel = schedules
          .filter((s) => s.patrol_type === "Checkpoint")
          .reduce((total, schedule) => {
            return total + (schedule.schedule_assignments?.length || 0);
          }, 0);

        const simexPersonnel = schedules
          .filter((s) => s.patrol_type === "Simulation Exercise")
          .reduce((total, schedule) => {
            return total + (schedule.schedule_assignments?.length || 0);
          }, 0);

        const specialEventPersonnel = schedules
          .filter((s) => s.patrol_type === "Special Event")
          .reduce((total, schedule) => {
            return total + (schedule.schedule_assignments?.length || 0);
          }, 0);

        setData((prev) => ({
          ...prev,
          mobilePatrolling: `No. of Scheduled: ${mobilePatrollingSchedules}\nTotal no. of Personnel: ${mobilePatrollingPersonnel}`,
          tmrUPatrolling: `No. of Scheduled: ${tmrUPatrollingSchedules}\nTotal no. of Personnel: ${tmrUPatrollingPersonnel}`,
          footPatrolling: `Total no. of Personnel: ${footPatrollingPersonnel}`,
          bikePatrolling: `Total no. of Personnel: ${bikePatrollingPersonnel}`,
          seabornePatrolling: `Total no. of Personnel: ${seabornePatrollingPersonnel}`,
          checkpoint: `No. of Scheduled: ${checkpointSchedules} \n Total no. of Personnel: ${checkpointPersonnel}`,
          simex: `Total no. of Personnel: ${simexPersonnel}`,
          specialEvent: `Total no. of Personnel: ${specialEventPersonnel}`,
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
        const bikeVehicles = vehiclesRes.data.filter(
          (v) => v.vehicle_type === "Bike",
        ).length;
        const atvVehicles = vehiclesRes.data.filter(
          (v) => v.vehicle_type === "ATV",
        ).length;
        const rescueBoatVehicles = vehiclesRes.data.filter(
          (v) => v.vehicle_type === "Rescue Boat",
        ).length;

        setData((prev) => ({
          ...prev,
          mobilePatrolVehicles,
          tmrUPatrolVehicles,
          bikePatrolVehicles: bikeVehicles,
          atvPatrolVehicles: atvVehicles,
          rescueBoatPatrolVehicles: rescueBoatVehicles,
        }));
      }

      // Fetch calendar events for today
      try {
        const startOfToday = startOfDay(new Date());
        const endOfToday = endOfDay(new Date());
        let calendarQuery = supabase
          .from("calendar")
          .select("*,unit:unit_id(unit_name)")
          .lte("start_date", startOfToday.toISOString())
          .gte("end_date", endOfToday.toISOString());

        // Apply unit filtering for non-admin users
        if (!isAdmin && unitId) {
          calendarQuery = calendarQuery.eq("unit_id", unitId);
        }

        const { data: calendarData, error: calendarError } =
          await calendarQuery;

        if (calendarError) throw calendarError;
        if (calendarData) setCalendarEvents(calendarData);
      } catch (err: any) {
        console.error("Error fetching calendar events:", err);
        // Non-fatal: we don't want to break the dashboard if calendar fails
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 ">
            <div className="lg:col-span-8">
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
                    value={data.activePersonnel.toString()}
                  />
                  <SummaryCard
                    label="Office Duty"
                    value={data.onOfficeDutyPersonnel.toString()}
                  />
                  <SummaryCard
                    label="Patrol Duty"
                    value={data.onPatrolDutyPersonnel.toString()}
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
              </div>
            </div>

            <div className="lg:col-span-4 lg:border-l lg:border-gray-300 dark:lg:border-gray-700 lg:pl-8">
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
                    label="Motorcycle"
                    value={data.tmrUPatrolVehicles.toString()}
                  />
                  <SummaryCard
                    label="Bike"
                    value={data.bikePatrolVehicles.toString()}
                  />
                  <SummaryCard
                    label="ATV"
                    value={data.atvPatrolVehicles?.toString() || "0"}
                  />
                  <SummaryCard
                    label="Rescue Boat"
                    value={data.rescueBoatPatrolVehicles?.toString() || "0"}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4 flex items-center gap-3 lg:border-t lg:border-gray-300 dark:lg:border-gray-700 lg:pt-4">
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
                fontSize="lg"
              />
              <SummaryCard
                label="TMRU Patrolling"
                value={data.tmrUPatrolling}
                fontSize="lg"
              />
              <SummaryCard
                label="Foot Patrolling"
                value={data.footPatrolling}
                fontSize="lg"
              />
              <SummaryCard
                label="Bike Patrolling"
                value={data.bikePatrolling}
                fontSize="lg"
              />
              <SummaryCard
                label="Checkpoint"
                value={data.checkpoint}
                fontSize="lg"
              />
              <SummaryCard
                label="Seaborne Patrolling"
                value={data.seabornePatrolling}
                fontSize="lg"
              />
              <SummaryCard
                label="Simulation Exercise"
                value={data.simex}
                fontSize="lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:border-t lg:border-gray-300 dark:lg:border-gray-700 lg:pt-8">
            {/* Calendar Events/Activities */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col transition-colors">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-blue-600" />
                  Calendar Events/Activities
                </h3>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {calendarEvents.length > 0 ? (
                  calendarEvents.map((event) => (
                    <div
                      key={event.id}
                      /* Updated: Added 'relative overflow-hidden' and adjusted padding to 'pl-6 pr-4 py-4' */
                      className="relative pl-6 pr-4 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors overflow-hidden"
                    >
                      {/* Left-Edge Ribbon Indicator */}
                      <div className="absolute left-0 top-0 bottom-0 w-1.5">
                        <LegendItem category={event.category!} />
                      </div>

                      <div className="flex items-center gap-4 w-full">
                        {/* Left: Main Details Block (Takes up 3/4 width) */}
                        <div className="w-3/4 min-w-0">
                          <p className="font-medium text-slate-900 dark:text-slate-200">
                            {event.title}{" "}
                            {format(new Date(event.start_date!), "hh:mm a")}{" "}
                            {format(new Date(event.end_date!), "hh:mm a")}
                          </p>
                          {event.description && (
                            <p className="text-slate-500 dark:text-slate-400 line-clamp-1">
                              Description: {event.description}
                            </p>
                          )}
                          {event.venue && (
                            <div className="mt-1 text-slate-500 dark:text-slate-400">
                              Venue: {event.venue}
                            </div>
                          )}
                        </div>

                        {/* Right: Unit Name Block (Takes up exactly 1/4 width) */}
                        <div className="w-1/4 text-right min-w-0">
                          {event.unit?.unit_name && (
                            <div className="text-slate-500 dark:text-slate-400 flex items-center justify-end gap-1 truncate">
                              <span className="truncate">
                                {event.unit.unit_name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                    No calendar events for today
                  </div>
                )}
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

function SummaryCard({
  label,
  value,
  fontSize,
}: {
  label: string;
  value: string;
  fontSize?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-colors w-full">
      {/* Middle: Content Block (Stretches to fill space) */}
      <div className="flex-1 min-w-0 whitespace-pre-line">
        <p className="mb-0.5">{label}</p>
        <h3
          className={`text-${fontSize || "4xl"} font-bold text-slate-900 dark:text-white leading-tight`}
        >
          {value}
        </h3>
      </div>
    </div>
  );
}

function LegendItem({ category }: { category: string }) {
  const colorClass =
    category === "Rush/Urgent"
      ? "bg-red-500"
      : category === "Priority"
        ? "bg-orange-500"
        : category === "Daily Routine"
          ? "bg-blue-500"
          : "bg-gray-400";

  // Use w-full h-full so it conforms to whichever container size you pick above!
  return <div className={`w-full h-full ${colorClass}`} />;
}
