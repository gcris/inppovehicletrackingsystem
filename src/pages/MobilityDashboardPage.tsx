import { useEffect, useState } from "react";
import { Car } from "lucide-react";

import DashboardSection from "./mobility/dashboard/DashboardSection";
import SectionTitle from "./mobility/dashboard/SectionTitle";

import {
  getLatestMaintenanceByType,
  getMaintenanceReminders,
} from "./utils/maintenanceStatus";
import {
  MaintenanceHistory,
  MobilityAsset,
  supabase,
  VehicleInspection,
} from "../lib/supabase";
import MobilityStatCard from "./mobility/dashboard/MobilityStatCard";
import UpcomingMaintenanceTable from "./mobility/dashboard/UpcomingMaintenanceTable";
import { useAuth } from "../components/AuthProvider";
import { mobilityType } from "../types/mobilityType";

type DashboardStatistics = {
  totalVehicles: number;

  serviceable: number;
  unserviceable: number;
  beyondEconomicRepair: number;

  goodMaintenance: number;
  dueSoon: number;
  overdue: number;

  registrationDue: number;
  insuranceDue: number;
};

interface VehicleTypeStat {
  type: string;
  count: number;
}

export default function MobilityDashboardPage() {
  const [loading, setLoading] = useState(true);

  const [statistics, setStatistics] = useState<DashboardStatistics>({
    totalVehicles: 0,

    serviceable: 0,
    unserviceable: 0,
    beyondEconomicRepair: 0,

    goodMaintenance: 0,
    dueSoon: 0,
    overdue: 0,

    registrationDue: 0,
    insuranceDue: 0,
  });
  const [upcomingMaintenance, setUpcomingMaintenance] = useState<any[]>([]);
  const [vehicleStats, setVehicleStats] = useState<VehicleTypeStat[]>([]);
  const { isAdmin, unitId } = useAuth();

  useEffect(() => {
    loadPage();
  }, []);

  const loadPage = async () => {
    setLoading(true);

    try {
      await loadMobilityByType();
      await loadMaintenanceStatus();
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const loadMobilityByType = async () => {
    let mobility_assets = supabase
      .from("mobility_assets")
      .select("vehicle_type");

    if (!isAdmin && unitId) {
      mobility_assets.eq("unit_id", unitId);
    }

    const { data: assets_data, error } = await mobility_assets;

    if (assets_data) {
      if (!error && assets_data) {
        const counts: Record<string, number> = {};

        mobilityType.forEach((type) => {
          counts[type] = 0;
        });

        assets_data.forEach((item) => {
          if (!item.vehicle_type) return;

          counts[item.vehicle_type] = (counts[item.vehicle_type] || 0) + 1;
        });

        setVehicleStats(
          mobilityType
            .map((type) => ({
              type,
              count: counts[type] || 0,
            }))
            .sort((a, b) => b.count - a.count),
        );
      }
    }
  };

  const loadMaintenanceStatus = async () => {
    let mobility_assets = supabase.from("mobility_assets").select(`
        *,
        maintenance_history:mobility_assets_maintenance_history(
          *,
          items:mobility_assets_maintenance_history_items(
            *,
            maintenance_type:maintenance_types(*)
          )
        ),
        unit:unit_id(*)
      `);

    if (!isAdmin && unitId) {
      mobility_assets.eq("unit_id", unitId);
    }

    const { data: vehiclesData, error: vehicleError } = await mobility_assets;

    if (vehicleError) throw vehicleError;

    const vehicleList =
      (vehiclesData as (MobilityAsset & {
        maintenance_history: MaintenanceHistory[];
      })[]) ?? [];

    let serviceable = 0;
    let unserviceable = 0;
    let beyondEconomicRepair = 0;

    let goodMaintenance = 0;
    let dueSoon = 0;
    let overdue = 0;

    let registrationDue = 0;
    let insuranceDue = 0;

    const today = new Date();

    const upcoming: any[] = [];
    const overdueList: any[] = [];

    vehicleList.forEach((vehicle) => {
      switch (vehicle.status) {
        case "Serviceable":
          serviceable++;
          break;

        case "Unserviceable":
          unserviceable++;
          break;

        case "Beyond Economic Repair":
          beyondEconomicRepair++;
          break;
      }

      const latest = [...(vehicle.maintenance_history ?? [])].sort(
        (a, b) =>
          new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime(),
      );

      const reminders = getMaintenanceReminders(
        latest,
        vehicle.current_odometer,
      );

      if (reminders.length === 0) {
        goodMaintenance++;
      } else {
        dueSoon += reminders.filter((r) => r.status === "DUE_SOON").length;

        overdue += reminders.filter((r) => r.status === "OVERDUE").length;

        goodMaintenance += reminders.filter((r) => r.status === "GOOD").length;
      }

      if (vehicle.date_registration_expires) {
        const expiry = new Date(vehicle.date_registration_expires);

        const daysRemaining = Math.ceil(
          (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysRemaining <= 30) {
          registrationDue++;
        }
      }

      if (vehicle.insurance_coverage_date) {
        const expiry = new Date(vehicle.insurance_coverage_date);

        const daysRemaining = Math.ceil(
          (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysRemaining <= 30) {
          insuranceDue++;
        }
      }

      reminders.forEach((reminder) => {
        const item = {
          plate_number: vehicle.plate_number,
          description: vehicle.description,
          unit_name: vehicle.unit?.unit_name,
          maintenance: reminder.maintenance_type_name,
          dueDate: reminder.next_service_date,
          dueOdometer: reminder.next_service_odometer,
          kmRemaining: reminder.km_remaining,
          daysRemaining: reminder.days_remaining,
          status: reminder.status,
        };

        upcoming.push(item);
      });
    });

    upcoming.sort((a, b) => {
      const aKm =
        a.kmRemaining == null ? Number.MAX_SAFE_INTEGER : a.kmRemaining;

      const bKm =
        b.kmRemaining == null ? Number.MAX_SAFE_INTEGER : b.kmRemaining;

      return aKm - bKm;
    });

    setStatistics({
      totalVehicles: vehicleList.length,
      serviceable,
      unserviceable,
      beyondEconomicRepair,
      goodMaintenance,
      dueSoon,
      overdue,
      registrationDue,
      insuranceDue,
    });

    setUpcomingMaintenance(upcoming.slice(0, 20));
  };

  return (
    <div className="space-y-6 p-6">
      <SectionTitle
        title="Mobility Dashboard"
        subtitle="Real-time monitoring of mobility assets, maintenance schedules, and inspections."
        icon={<Car className="h-9 w-9 text-blue-600" />}
      />
      {/* Mobility Type Statistics */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 border-b pb-1 border-slate-200 dark:border-slate-800">
          Mobility Assets
        </h2>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-7">
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"
              />
            ))
          : vehicleStats.map((item) => (
              <MobilityStatCard
                key={item.type}
                title={item.type}
                value={item.count}
                bg_color="bg-white dark:bg-slate-900"
                border_color="border-slate-700"
              />
            ))}
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-800 border-b pb-1 border-slate-200 dark:border-slate-800">
          Mobility Statistics
        </h2>
      </div>
      {/* Maintenance/Status Statistics */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"
            />
          ))
        ) : (
          <>
            <MobilityStatCard
              title="Serviceable"
              value={statistics.serviceable}
              bg_color="bg-emerald-50 dark:bg-emerald-950"
              border_color="border-emerald-200 dark:border-emerald-800"
            />

            <MobilityStatCard
              title="Unserviceable"
              value={statistics.unserviceable}
              bg_color="bg-orange-50 dark:bg-orange-950"
              border_color="border-orange-200 dark:border-orange-800"
            />

            <MobilityStatCard
              title="Beyond Economic Repair"
              value={statistics.beyondEconomicRepair}
              bg_color="bg-red-50 dark:bg-red-950"
              border_color="border-red-200 dark:border-red-800"
            />

            <MobilityStatCard
              title="Registration"
              value={statistics.registrationDue}
              bg_color="bg-amber-50 dark:bg-amber-950"
              border_color="border-amber-200 dark:border-amber-800"
            />

            <MobilityStatCard
              title="Insurance"
              value={statistics.insuranceDue}
              bg_color="bg-sky-50 dark:bg-sky-950"
              border_color="border-sky-200 dark:border-sky-800"
            />

            <MobilityStatCard
              title="PMS"
              value={statistics.dueSoon + statistics.overdue}
              bg_color="bg-violet-50 dark:bg-violet-950"
              border_color="border-violet-200 dark:border-violet-800"
            />
          </>
        )}
      </div>
      <div className="grid gap-6">
        <DashboardSection title="Upcoming Periodic Maintenance Service Schedule">
          <UpcomingMaintenanceTable data={upcomingMaintenance} />
        </DashboardSection>
      </div>
    </div>
  );
}
