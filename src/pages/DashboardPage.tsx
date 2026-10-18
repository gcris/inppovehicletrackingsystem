import React, { useCallback, useEffect, useState } from "react";
import { supabase, Calendar, Unit, Sector } from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";
import {
  Activity,
  CalendarDays,
  Clock,
  Users,
  Car,
  Bike,
  Ship,
  Shield,
  Footprints,
  Radio,
  CheckCircle2,
  Building2,
  RefreshCw,
  Truck,
  LayoutDashboard,
  Check,
  Motorbike,
  Star,
  Drone,
} from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { Link } from "react-router-dom";
import { NumberMap } from "framer-motion";
import { FaMotorcycle, FaRegListAlt, FaUserSecret } from "react-icons/fa";

/*
|--------------------------------------------------------------------------
| TYPES
|--------------------------------------------------------------------------
*/

type ScheduleAssignment = {
  personnel?: {
    id?: string;
    fullname?: string;
    rank?: {
      id?: string;
      rank_name?: string;
      level?: number;
    };
  };
};

type PatrolSchedule = {
  id: string;
  unit?: {
    id?: string;
    unit_name?: string;
  };
  sector_id?: string;
  patrol_type?: string;
  time_from?: string;
  time_to?: string;
  schedule_assignments?: ScheduleAssignment[];

  sector?: Sector;
};

type DashboardData = {
  totalStrength: number;
  activePersonnel: number;
  ineffectivePersonnel: number;
  offDutyPersonnel: number;
  onPatrolDutyPersonnel: number;
  onOfficeDutyPersonnel: number;

  mobilePatrolling: {
    scheduled: number;
    personnel: number;
  };

  tmruPatrolling: {
    scheduled: number;
    personnel: number;
  };

  footPatrolling: {
    scheduled: number;
    personnel: number;
  };

  bikePatrolling: {
    scheduled: number;
    personnel: number;
  };

  checkpoint: {
    scheduled: number;
    personnel: number;
  };

  seabornePatrolling: {
    scheduled: number;
    personnel: number;
  };

  simex: {
    scheduled: number;
    personnel: number;
  };

  specialEvent: {
    scheduled: number;
    personnel: number;
  };

  dodon: {
    scheduled: number;
    personnel: number;
  };

  intelDrivenOperation: {
    scheduled: number;
    personnel: number;
  };

  specialLaws: {
    scheduled: number;
    personnel: number;
  };

  totalVehicles: number;
  mobilePatrolVehicles: number;
  motorcycleVehicles: number;
  bikeVehicles: number;
  atvVehicles: number;
  rescueBoatVehicles: number;
  truckVehicles: number;

  schedules: PatrolSchedule[];
};

const initialData: DashboardData = {
  totalStrength: 0,
  activePersonnel: 0,
  ineffectivePersonnel: 0,
  offDutyPersonnel: 0,
  onPatrolDutyPersonnel: 0,
  onOfficeDutyPersonnel: 0,

  mobilePatrolling: {
    scheduled: 0,
    personnel: 0,
  },

  tmruPatrolling: {
    scheduled: 0,
    personnel: 0,
  },

  footPatrolling: {
    scheduled: 0,
    personnel: 0,
  },

  bikePatrolling: {
    scheduled: 0,
    personnel: 0,
  },

  checkpoint: {
    scheduled: 0,
    personnel: 0,
  },

  seabornePatrolling: {
    scheduled: 0,
    personnel: 0,
  },
  simex: {
    scheduled: 0,
    personnel: 0,
  },
  specialEvent: {
    scheduled: 0,
    personnel: 0,
  },

  dodon: {
    scheduled: 0,
    personnel: 0,
  },

  intelDrivenOperation: {
    scheduled: 0,
    personnel: 0,
  },

  specialLaws: {
    scheduled: 0,
    personnel: 0,
  },

  totalVehicles: 0,
  mobilePatrolVehicles: 0,
  motorcycleVehicles: 0,
  bikeVehicles: 0,
  atvVehicles: 0,
  rescueBoatVehicles: 0,
  truckVehicles: 0,

  schedules: [],
};

/*
|--------------------------------------------------------------------------
| DASHBOARD PAGE
|--------------------------------------------------------------------------
*/

export default function DashboardPage() {
  const { unitId, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unitName, setUnitName] = useState("");
  const [data, setData] = useState<DashboardData>(initialData);
  const [calendarEvents, setCalendarEvents] = useState<Calendar[]>([]);
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [units, setUnits] = useState<Unit[]>([]);

  /*
  |--------------------------------------------------------------------------
  | FETCH DASHBOARD DATA
  |--------------------------------------------------------------------------
  */

  const fetchDashboardData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const today = new Date();

        const todayDate = format(today, "yyyy-MM-dd");

        /*
        |--------------------------------------------------------------------------
        | UNIT NAME
        |--------------------------------------------------------------------------
        */

        if (!isAdmin && unitId) {
          const { data: unit, error: unitError } = await supabase
            .from("unit")
            .select("unit_name")
            .eq("id", unitId)
            .single();

          if (unitError) {
            console.error("Error fetching unit:", unitError);
          }

          setUnitName(unit?.unit_name ?? "");
        } else {
          setUnitName("Provincial Headquarters");
        }

        /*
        |--------------------------------------------------------------------------
        | PERSONNEL COUNT QUERIES
        |
        | IMPORTANT:
        | count: "exact"
        | head: true
        |
        | This means Supabase returns ONLY the count.
        | It does not download the personnel rows.
        |--------------------------------------------------------------------------
        */

        let totalPersonnelQuery = supabase.from("personnel").select("*", {
          count: "exact",
          head: true,
        });

        let activePersonnelQuery = supabase
          .from("personnel")
          .select("*", {
            count: "exact",
            head: true,
          })
          .in("duty_status", ["Active Duty", "Detached Service"]);

        let ineffectivePersonnelQuery = supabase
          .from("personnel")
          .select("*", {
            count: "exact",
            head: true,
          })
          .not("duty_status", "in", '("Active Duty","Detached Service")');

        /*
        |--------------------------------------------------------------------------
        | VEHICLE COUNT QUERIES
        |--------------------------------------------------------------------------
        */

        let totalVehicleQuery = supabase
          .from("mobility_assets")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("status", "Serviceable");

        let mobilePatrolVehiclesQuery = supabase
          .from("mobility_assets")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("status", "Serviceable")
          .not("vehicle_type", "ilike", "%Motorcycle%")
          .not("vehicle_type", "ilike", "%ATV%")
          .not("vehicle_type", "ilike", "%Bike%")
          .not("vehicle_type", "ilike", "%Bus%")
          .not("vehicle_type", "ilike", "%Boat%")
          .not("vehicle_type", "ilike", "%Truck%");

        let motorcycleVehiclesQuery = supabase
          .from("mobility_assets")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("status", "Serviceable")
          .ilike("vehicle_type", "%Motorcycle%");

        let bikeVehiclesQuery = supabase
          .from("mobility_assets")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("status", "Serviceable")
          .eq("vehicle_type", "Bike");

        let atvVehiclesQuery = supabase
          .from("mobility_assets")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("status", "Serviceable")
          .ilike("vehicle_type", "%ATV%");

        let rescueBoatVehiclesQuery = supabase
          .from("mobility_assets")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("status", "Serviceable")
          .eq("vehicle_type", "Rescue Boat");

        let truckVehiclesQuery = supabase
          .from("mobility_assets")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("status", "Serviceable")
          .eq("vehicle_type", "Truck");

        /*
        |--------------------------------------------------------------------------
        | APPLY UNIT FILTER TO COUNTS
        |--------------------------------------------------------------------------
        */

        let filterUnitId = "";

        // if admin and with selectedUnit
        if (selectedUnit !== "all") {
          filterUnitId = selectedUnit;
        } else {
          filterUnitId = isAdmin ? "" : unitId || "";
        }

        if (filterUnitId) {
          totalPersonnelQuery = totalPersonnelQuery.eq("unit_id", filterUnitId);

          activePersonnelQuery = activePersonnelQuery.eq(
            "unit_id",
            filterUnitId,
          );

          ineffectivePersonnelQuery = ineffectivePersonnelQuery.eq(
            "unit_id",
            filterUnitId,
          );

          totalVehicleQuery = totalVehicleQuery.eq("unit_id", filterUnitId);

          mobilePatrolVehiclesQuery = mobilePatrolVehiclesQuery.eq(
            "unit_id",
            filterUnitId,
          );

          motorcycleVehiclesQuery = motorcycleVehiclesQuery.eq(
            "unit_id",
            filterUnitId,
          );

          bikeVehiclesQuery = bikeVehiclesQuery.eq("unit_id", filterUnitId);

          atvVehiclesQuery = atvVehiclesQuery.eq("unit_id", filterUnitId);

          rescueBoatVehiclesQuery = rescueBoatVehiclesQuery.eq(
            "unit_id",
            filterUnitId,
          );

          truckVehiclesQuery = truckVehiclesQuery.eq("unit_id", filterUnitId);
        }

        /*
        |--------------------------------------------------------------------------
        | TODAY'S SCHEDULE
        |
        | We need actual rows here because the dashboard displays
        | personnel names, rank, sector, time, etc.
        |--------------------------------------------------------------------------
        */

        let schedulesQuery = supabase
          .from("patrol_schedule")
          .select(
            `
            id,
            date,
            sector_id,
            patrol_type,
            time_from,
            time_to,
            unit_id,
            mobility_id,
            location,
            sector (
              id,
              deployment,
              sector,
              unit_id
            ),
            unit:unit_id (
              id,
              unit_name
            ),
            schedule_assignments (
              id,
              schedule_id,
              personnel_id,
              personnel (
                id,
                fullname,
                rank (
                  id,
                  rank_name,
                  level
                )
              )
            )
          `,
          )
          .eq("date", todayDate)
          .order("time_from", {
            ascending: true,
          });

        if (!isAdmin && unitId) {
          schedulesQuery = schedulesQuery.eq("unit_id", unitId);
        } else {
          if (selectedUnit !== "all") {
            schedulesQuery = schedulesQuery.eq("unit_id", selectedUnit);
          }
        }

        /*
        |--------------------------------------------------------------------------
        | CALENDAR
        |
        | Fetch only events overlapping today.
        |--------------------------------------------------------------------------
        */

        let calendarQuery = supabase
          .from("calendar")
          .select(
            `
            *,
            unit:unit_id(
              unit_name
            )
          `,
          )
          .lte("start_date", endOfDay(today).toISOString())
          .gte("end_date", startOfDay(today).toISOString())
          .order("start_date", {
            ascending: true,
          });

        if (!isAdmin && unitId) {
          calendarQuery = calendarQuery.eq("unit_id", unitId);
        } else {
          if (selectedUnit !== "all") {
            calendarQuery = calendarQuery.eq("unit_id", selectedUnit);
          }
        }

        /*
        |--------------------------------------------------------------------------
        | EXECUTE EVERYTHING IN PARALLEL
        |--------------------------------------------------------------------------
        */

        const [
          totalPersonnelRes,
          activePersonnelRes,
          ineffectivePersonnelRes,

          totalVehicleRes,
          mobilePatrolVehiclesRes,
          motorcycleVehiclesRes,
          bikeVehiclesRes,
          atvVehiclesRes,
          rescueBoatVehiclesRes,
          truckVehicleRes,

          schedulesRes,
          calendarRes,
        ] = await Promise.all([
          totalPersonnelQuery,
          activePersonnelQuery,
          ineffectivePersonnelQuery,

          totalVehicleQuery,
          mobilePatrolVehiclesQuery,
          motorcycleVehiclesQuery,
          bikeVehiclesQuery,
          atvVehiclesQuery,
          rescueBoatVehiclesQuery,
          truckVehiclesQuery,

          schedulesQuery,
          calendarQuery,
        ]);

        /*
        |--------------------------------------------------------------------------
        | ERROR HANDLING
        |--------------------------------------------------------------------------
        */

        if (totalPersonnelRes.error) throw totalPersonnelRes.error;

        if (activePersonnelRes.error) throw activePersonnelRes.error;

        if (ineffectivePersonnelRes.error) throw ineffectivePersonnelRes.error;

        if (totalVehicleRes.error) throw totalVehicleRes.error;

        if (mobilePatrolVehiclesRes.error) throw mobilePatrolVehiclesRes.error;

        if (motorcycleVehiclesRes.error) throw motorcycleVehiclesRes.error;

        if (bikeVehiclesRes.error) throw bikeVehiclesRes.error;

        if (atvVehiclesRes.error) throw atvVehiclesRes.error;

        if (rescueBoatVehiclesRes.error) throw rescueBoatVehiclesRes.error;

        if (truckVehicleRes.error) throw truckVehicleRes.error;

        if (schedulesRes.error) throw schedulesRes.error;

        if (calendarRes.error) throw calendarRes.error;

        /*
        |--------------------------------------------------------------------------
        | PERSONNEL COUNTS
        |--------------------------------------------------------------------------
        */

        const totalStrength = totalPersonnelRes.count ?? 0;

        const activePersonnel = activePersonnelRes.count ?? 0;

        const ineffectivePersonnel = ineffectivePersonnelRes.count ?? 0;

        /*
        |--------------------------------------------------------------------------
        | SCHEDULE DATA
        |--------------------------------------------------------------------------
        */

        const schedules: PatrolSchedule[] = (schedulesRes.data ?? []).map(
          (schedule) => ({
            ...schedule,

            sector: Array.isArray(schedule.sector)
              ? (schedule.sector[0] ?? undefined)
              : (schedule.sector ?? undefined),

            unit: Array.isArray(schedule.unit)
              ? (schedule.unit[0] ?? undefined)
              : (schedule.unit ?? undefined),

            schedule_assignments: (schedule.schedule_assignments ?? []).map(
              (assignment) => ({
                ...assignment,

                personnel: Array.isArray(assignment.personnel)
                  ? (assignment.personnel[0] ?? undefined)
                  : (assignment.personnel ?? undefined),
              }),
            ),
          }),
        );

        /*
        |--------------------------------------------------------------------------
        | COUNT ASSIGNED PERSONNEL
        |--------------------------------------------------------------------------
        */

        const getPatrolPersonnel = (patrolType: string) => {
          return schedules
            .filter((schedule) => schedule.patrol_type === patrolType)
            .reduce(
              (total, schedule) =>
                total + (schedule.schedule_assignments?.length ?? 0),
              0,
            );
        };

        /*
        |--------------------------------------------------------------------------
        | COUNT SCHEDULES
        |--------------------------------------------------------------------------
        */

        const getScheduleCount = (patrolType: string) => {
          return schedules.filter(
            (schedule) => schedule.patrol_type === patrolType,
          ).length;
        };

        /*
        |--------------------------------------------------------------------------
        | DUTY COUNTS
        |--------------------------------------------------------------------------
        */

        const onPatrolDutyPersonnel = schedules
          .filter((schedule) => schedule.patrol_type !== "Remain in Office")
          .reduce(
            (total, schedule) =>
              total + (schedule.schedule_assignments?.length ?? 0),
            0,
          );

        const onOfficeDutyPersonnel = schedules
          .filter((schedule) => schedule.patrol_type === "Remain in Office")
          .reduce(
            (total, schedule) =>
              total + (schedule.schedule_assignments?.length ?? 0),
            0,
          );

        /*
        |--------------------------------------------------------------------------
        | OFF DUTY
        |
        | Never allow the dashboard to show a negative number.
        |--------------------------------------------------------------------------
        */

        const offDutyPersonnel = Math.max(
          0,
          activePersonnel - onPatrolDutyPersonnel - onOfficeDutyPersonnel,
        );

        /*
        |--------------------------------------------------------------------------
        | PATROL STATISTICS
        |--------------------------------------------------------------------------
        */

        const mobilePatrolling = {
          scheduled: getScheduleCount("Mobile Patrolling"),
          personnel: getPatrolPersonnel("Mobile Patrolling"),
        };

        const tmruPatrolling = {
          scheduled: getScheduleCount("TMRU Patrolling"),
          personnel: getPatrolPersonnel("TMRU Patrolling"),
        };

        const checkpoint = {
          scheduled: getScheduleCount("Checkpoint"),
          personnel: getPatrolPersonnel("Checkpoint"),
        };

        const footPatrolling = {
          scheduled: getScheduleCount("Foot Patrolling"),
          personnel: getPatrolPersonnel("Foot Patrolling"),
        };

        const bikePatrolling = {
          scheduled: getScheduleCount("Bike Patrolling"),
          personnel: getPatrolPersonnel("Bike Patrolling"),
        };

        const seabornePatrolling = {
          scheduled: getScheduleCount("Seaborne Patrolling"),
          personnel: getPatrolPersonnel("Seaborne Patrolling"),
        };

        const simex = {
          scheduled: getScheduleCount("Simulation Exercise"),
          personnel: getPatrolPersonnel("Simulation Exercise"),
        };

        const specialEvent = {
          scheduled: getScheduleCount("Special Event"),
          personnel: getPatrolPersonnel("Special Event"),
        };

        const dodon = {
          scheduled: getScheduleCount("Dodon"),
          personnel: getPatrolPersonnel("Dodon"),
        };

        const intelDrivenOperation = {
          scheduled: getScheduleCount("Intel-Driven Operation"),
          personnel: getPatrolPersonnel("Intel-Driven Operation"),
        };

        const specialLaws = {
          scheduled: getScheduleCount("Special Laws"),
          personnel: getPatrolPersonnel("Special Laws"),
        };

        /*
        |--------------------------------------------------------------------------
        | VEHICLE COUNTS
        |--------------------------------------------------------------------------
        */

        const totalVehicles = totalVehicleRes.count ?? 0;

        const mobilePatrolVehicles = mobilePatrolVehiclesRes.count ?? 0;

        const motorcycleVehicles = motorcycleVehiclesRes.count ?? 0;

        const bikeVehicles = bikeVehiclesRes.count ?? 0;

        const atvVehicles = atvVehiclesRes.count ?? 0;

        const rescueBoatVehicles = rescueBoatVehiclesRes.count ?? 0;

        const truckVehicles = truckVehicleRes.count ?? 0;

        /*
        |--------------------------------------------------------------------------
        | UPDATE DASHBOARD STATE
        |--------------------------------------------------------------------------
        */

        setData({
          totalStrength,
          activePersonnel,
          ineffectivePersonnel,
          offDutyPersonnel,

          onPatrolDutyPersonnel,
          onOfficeDutyPersonnel,

          mobilePatrolling,
          tmruPatrolling,

          footPatrolling,
          bikePatrolling,

          checkpoint,

          seabornePatrolling,
          simex,
          specialEvent,
          dodon,
          intelDrivenOperation,
          specialLaws,

          totalVehicles,
          mobilePatrolVehicles,
          motorcycleVehicles,
          bikeVehicles,
          atvVehicles,
          rescueBoatVehicles,
          truckVehicles,

          schedules,
        });

        setCalendarEvents((calendarRes.data as Calendar[]) ?? []);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAdmin, unitId, selectedUnit],
  );

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from("unit")
      .select("*")
      .order("level", { ascending: false })
      .order("unit_name", { ascending: true });

    if (!error && data) {
      setUnits(data);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | LOAD DASHBOARD
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    fetchUnits();
    fetchDashboardData();
  }, [fetchDashboardData]);

  /*
  |--------------------------------------------------------------------------
  | LOADING SCREEN
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />

          <p className="font-medium text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | DASHBOARD
  |--------------------------------------------------------------------------
  */

  return (
    <div className="space-y-8 pb-8">
      {/* =========================================================
          HEADER
      ========================================================= */}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Left Section: Title & Icon */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
              <LayoutDashboard className="w-7 h-7" />
            </div>

            <div className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950">
              <Check className="w-3 h-3 text-white" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {unitName || "Dashboard"}
            </h1>

            <p className="mt-0.5 text-slate-500 dark:text-slate-400">
              Daily operational overview and situational awareness
            </p>
          </div>
        </div>

        {/* Right Section: Dropdown + Refresh Button grouped together */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <select
            value={selectedUnit}
            onChange={(e) => {
              if (isAdmin) {
                setSelectedUnit(e.target.value);
              }
            }}
            disabled={!isAdmin}
            className={`border border-slate-400 dark:border-slate-600 rounded-xl px-4 py-2.5 font-bold bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none ${
              !isAdmin ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <option value="all">All Units/Stations</option>

            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.unit_name}
              </option>
            ))}
          </select>

          <button
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw
              className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* =========================================================
          DATE / TIME
      ========================================================= */}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Clock className="h-5 w-5 text-blue-600" />

        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {format(new Date(), "EEEE, MMMM dd, yyyy")}
        </span>

        <span className="text-slate-300 dark:text-slate-700">•</span>

        <span className="font-black text-slate-900 dark:text-white">
          {format(new Date(), "HH:mm")}
        </span>
      </div>

      {/* =========================================================
          PERSONNEL
      ========================================================= */}

      <DashboardSection
        icon={Users}
        title="Personnel Strength"
        description="Current personnel availability and deployment"
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Total Strength"
            value={data.totalStrength}
            icon={Users}
            accent="blue"
            to="/personnel"
          />

          <StatCard
            label="Actual Present"
            value={data.activePersonnel}
            icon={CheckCircle2}
            accent="emerald"
            to="/personnel?filter=actual-present"
          />

          <StatCard
            label="Office Duty"
            value={data.onOfficeDutyPersonnel}
            icon={Building2}
            accent="indigo"
            to="/personnel?filter=office-duty"
          />

          <StatCard
            label="Patrol Duty"
            value={data.onPatrolDutyPersonnel}
            icon={Shield}
            accent="amber"
            to="/personnel?filter=patrol-duty"
          />

          <StatCard
            label="Off Duty"
            value={data.offDutyPersonnel}
            icon={Clock}
            accent="slate"
            to="/personnel?filter=off-duty"
          />

          <StatCard
            label="Ineffective"
            value={data.ineffectivePersonnel}
            icon={Radio}
            accent="red"
            to="/personnel?filter=ineffective"
          />
        </div>
      </DashboardSection>

      {/* =========================================================
          MOBILITY ASSETS
      ========================================================= */}

      <DashboardSection
        icon={Car}
        title="Mobility Assets"
        description="Available mobility assets assigned to the unit/station"
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
          <StatCard
            label="Total Mobility"
            value={data.totalVehicles}
            icon={FaRegListAlt}
            accent="slate"
            to="/mobility-assets?filter=all"
          />

          <StatCard
            label="Mobile Patrolling"
            value={data.mobilePatrolVehicles}
            icon={Car}
            accent="blue"
            to="/mobility-assets?filter=mobile-patrol"
          />

          <StatCard
            label="Motorcycle"
            value={data.motorcycleVehicles}
            icon={FaMotorcycle}
            accent="indigo"
            to="/mobility-assets?filter=motorcycle"
          />

          <StatCard
            label="Bike"
            value={data.bikeVehicles}
            icon={Bike}
            accent="emerald"
            to="/mobility-assets?filter=bike"
          />

          <StatCard
            label="ATV"
            value={data.atvVehicles}
            icon={Car}
            accent="amber"
            to="/mobility-assets?filter=atv"
          />

          <StatCard
            label="Rescue Boat"
            value={data.rescueBoatVehicles}
            icon={Ship}
            accent="cyan"
            to="/mobility-assets?filter=rescue-boat"
          />

          <StatCard
            label="Truck"
            value={data.truckVehicles}
            icon={Truck}
            accent="slate"
            to="/mobility-assets?filter=truck"
          />
        </div>
      </DashboardSection>

      {/* =========================================================
          PATROL STATISTICS
      ========================================================= */}

      <DashboardSection
        icon={Shield}
        title="Today's Patrolling Statistics"
        description="Personnel scheduled for today's operations"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <PatrolCard
            label="Foot Patrolling"
            personnel={data.footPatrolling.personnel}
            scheduled={data.footPatrolling.scheduled}
            icon={Footprints}
          />

          <PatrolCard
            label="Mobile Patrolling"
            personnel={data.mobilePatrolling.personnel}
            scheduled={data.mobilePatrolling.scheduled}
            icon={Car}
          />

          <PatrolCard
            label="TMRU Patrolling"
            personnel={data.tmruPatrolling.personnel}
            scheduled={data.tmruPatrolling.scheduled}
            icon={Motorbike}
          />

          <PatrolCard
            label="Bike Patrolling"
            personnel={data.bikePatrolling.personnel}
            scheduled={data.bikePatrolling.scheduled}
            icon={Bike}
          />

          <PatrolCard
            label="Seaborne"
            personnel={data.seabornePatrolling.personnel}
            scheduled={data.seabornePatrolling.scheduled}
            icon={Ship}
          />

          <PatrolCard
            label="Checkpoint"
            personnel={data.checkpoint.personnel}
            scheduled={data.checkpoint.scheduled}
            icon={Shield}
          />

          <PatrolCard
            label="Special Events"
            personnel={data.specialEvent.personnel}
            scheduled={data.specialEvent.scheduled}
            icon={Star}
          />

          <PatrolCard
            label="SIMEX"
            personnel={data.simex.personnel}
            scheduled={data.simex.scheduled}
            icon={Radio}
          />

          <PatrolCard
            label="DODON"
            personnel={data.dodon.personnel}
            scheduled={data.dodon.scheduled}
            icon={Drone}
          />
          <PatrolCard
            label="Intel-Driven Operation"
            personnel={data.intelDrivenOperation.personnel}
            scheduled={data.intelDrivenOperation.scheduled}
            icon={FaUserSecret}
          />

          <PatrolCard
            label="Special Laws"
            personnel={data.specialLaws.personnel}
            scheduled={data.specialLaws.scheduled}
            icon={CheckCircle2}
          />
        </div>
      </DashboardSection>

      {/* =========================================================
          CALENDAR + PATROL SCHEDULE
      ========================================================= */}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* =======================================================
            CALENDAR
        ======================================================= */}

        <DashboardPanel
          title="Calendar Events / Activities"
          icon={CalendarDays}
        >
          {calendarEvents.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {calendarEvents.map((event) => (
                <CalendarEvent key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <EmptyState text="No calendar events for today." />
          )}
        </DashboardPanel>

        {/* =======================================================
            PATROL SCHEDULE
        ======================================================= */}

        <div className="xl:col-span-2">
          <DashboardPanel
            title="Today's Patrol Schedule"
            icon={Clock}
            action={
              <Link
                to="/schedule"
                className="text-blue-600 hover:text-blue-700"
              >
                View Full Schedule
              </Link>
            }
          >
            {data.schedules.length > 0 ? (
              <div className="space-y-3">
                {data.schedules.slice(0, 6).map((schedule) => (
                  <ScheduleItem key={schedule.id} schedule={schedule} />
                ))}
              </div>
            ) : (
              <EmptyState text="No patrol assignments for today." />
            )}
          </DashboardPanel>
        </div>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| DASHBOARD SECTION
|--------------------------------------------------------------------------
*/

function DashboardSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40">
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            {title}
          </h2>

          <p className="text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>

      {children}
    </section>
  );
}

/*
|--------------------------------------------------------------------------
| STAT CARD
|--------------------------------------------------------------------------
*/

function StatCard({
  label,
  value,
  icon: Icon,
  accent = "blue",
  to,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent?: "blue" | "emerald" | "indigo" | "amber" | "slate" | "red" | "cyan";
  to?: string;
}) {
  const accents = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
    emerald:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
    indigo:
      "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400",
    amber:
      "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    red: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
    cyan: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400",
  };

  // Base card inner layout
  const CardBody = () => (
    <>
      {/* Top accent line (visible when 'to' prop exists or always on link hover) */}
      {to && (
        <div
          className="
            absolute inset-x-0 top-0 h-1
            bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500
            transition-all duration-300
            group-hover:h-1.5
          "
        />
      )}

      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accents[accent]}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <p
          className="truncate text-sm font-bold text-slate-800 dark:text-slate-200"
          title={label}
        >
          {label}
        </p>
      </div>

      <div className="mt-4">
        <p className="text-center text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          {value.toLocaleString()}
        </p>
      </div>
    </>
  );

  const containerClasses = `
    group relative block w-full overflow-hidden rounded-2xl border p-4 shadow-sm 
    transition-all duration-300
    ${
      to
        ? "border-sky-200 hover:-translate-y-1 hover:shadow-lg dark:border-sky-800 bg-white dark:bg-slate-900"
        : "border-slate-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 bg-white dark:bg-slate-900"
    }
  `;

  if (to) {
    return (
      <Link to={to} className={containerClasses}>
        <CardBody />
      </Link>
    );
  }

  return (
    <div className={containerClasses}>
      <CardBody />
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| PATROL CARD
|--------------------------------------------------------------------------
*/

function PatrolCard({
  label,
  personnel,
  scheduled,
  icon: Icon,
}: {
  label: string;
  personnel: number;
  scheduled?: number;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
          <Icon className="h-5 w-5" />
        </div>

        {scheduled !== undefined && (
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[14px] text-slate-800 dark:bg-slate-800 dark:text-slate-200">
            {scheduled} SCHED
          </span>
        )}
      </div>

      <p className="mt-4 font-bold text-slate-800 dark:text-slate-200">
        {label}
      </p>

      <p className="mt-1 text-3xl font-black text-slate-900 dark:text-white">
        {personnel.toLocaleString()}
      </p>

      <p className="mt-1 text-slate-500 dark:text-slate-400">Personnel</p>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| DASHBOARD PANEL
|--------------------------------------------------------------------------
*/

function DashboardPanel({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: React.ElementType;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <h3 className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
          <Icon className="h-5 w-5 text-blue-600" />

          {title}
        </h3>

        {action}
      </div>

      <div className="p-4">{children}</div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| CALENDAR EVENT
|--------------------------------------------------------------------------
*/

function CalendarEvent({ event }: { event: Calendar }) {
  const category = event.category ?? "";

  const categoryColor =
    category === "Rush/Urgent"
      ? "bg-red-500"
      : category === "Priority"
        ? "bg-orange-500"
        : category === "Daily Routine"
          ? "bg-blue-500"
          : "bg-slate-400";

  return (
    <div className="relative flex gap-4 px-2 py-4">
      <div
        className={`absolute left-0 top-4 bottom-4 w-1 rounded-full ${categoryColor}`}
      />

      <div className="min-w-0 flex-1 pl-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-900 dark:text-white">
              {event.title}
            </p>

            <p className="mt-1 font-medium text-slate-500">
              {format(new Date(event.start_date!), "hh:mm a")}

              {" – "}

              {format(new Date(event.end_date!), "hh:mm a")}
            </p>
          </div>

          {event.unit?.unit_name && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {event.unit.unit_name}
            </span>
          )}
        </div>

        {event.description && (
          <p className="mt-2 line-clamp-2 text-slate-500 dark:text-slate-400">
            {event.description}
          </p>
        )}

        {event.venue && (
          <p className="mt-2 font-medium text-slate-500">
            Venue: {event.venue}
          </p>
        )}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| SCHEDULE ITEM
|--------------------------------------------------------------------------
*/

function ScheduleItem({ schedule }: { schedule: PatrolSchedule }) {
  const assignments = schedule.schedule_assignments ?? [];

  /*
   * Sort personnel by rank.level DESC.
   *
   * Higher rank.level appears first.
   */

  const personnelNames = [...assignments]
    .sort((a, b) => {
      const rankA = a.personnel?.rank?.level ?? -Infinity;

      const rankB = b.personnel?.rank?.level ?? -Infinity;

      return rankB - rankA;
    })
    .map((assignment) => {
      const rank = assignment.personnel?.rank?.rank_name;

      const fullname = assignment.personnel?.fullname;

      return [rank, fullname].filter(Boolean).join(" ");
    })
    .filter(Boolean);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-black text-blue-600">
              {schedule.patrol_type}
            </span>

            {schedule.unit?.unit_name && (
              <span className="font-semibold text-slate-400">
                • {schedule.unit.unit_name}
              </span>
            )}

            {schedule.sector && (
              <span className="font-semibold text-slate-400">
                • {schedule.sector?.sector}
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2 font-bold text-slate-500">
            <Clock className="h-3.5 w-3.5" />

            {schedule.time_from?.slice(0, 5) ?? "--:--"}

            {" – "}

            {schedule.time_to?.slice(0, 5) ?? "--:--"}
          </div>
        </div>

        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-black text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
          <Users className="h-3.5 w-3.5" />

          {assignments.length}
        </span>
      </div>

      <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
        {personnelNames.length > 0 ? (
          <p className="leading-relaxed text-slate-700 dark:text-slate-300">
            {personnelNames.join(", ")}
          </p>
        ) : (
          <p className="font-medium italic text-slate-400">Unassigned</p>
        )}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| EMPTY STATE
|--------------------------------------------------------------------------
*/

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
        <CalendarDays className="h-5 w-5" />
      </div>

      <p className="mt-3 font-medium text-slate-400">{text}</p>
    </div>
  );
}
