import { useEffect, useState } from "react";

import SectionTitle from "./mobility/dashboard/SectionTitle";

import { getMaintenanceReminders } from "./utils/maintenanceStatus";
import { MaintenanceHistory, MobilityAsset, supabase } from "../lib/supabase";
import MobilityStatCard from "./mobility/dashboard/MobilityStatCard";
import { useAuth } from "../components/AuthProvider";
import { mobilityType } from "../types/mobilityType";
import VehicleTypeCard from "./mobility/dashboard/VehicleTypeCard";
import DefectTrendChart, {
  DefectItemData,
  DefectTrendData,
} from "./mobility/dashboard/DefectTrendChart";

type DashboardStatistics = {
  totalVehicles: number;

  serviceable: number;
  unserviceable: number;
  beyondEconomicRepair: number;

  organic: number;
  donated: number;
  loaned: number;

  goodMaintenance: number;
  dueSoon: number;
  overdue: number;

  registrationDue: number;
  registrationExpiringSoon: number;
  registrationExpired: number;

  insuranceDue: number;
  insuranceExpiringSoon: number;
  insuranceExpired: number;
};

export default function MobilityDashboardPage() {
  const [loading, setLoading] = useState(true);

  const [statistics, setStatistics] = useState<DashboardStatistics>({
    totalVehicles: 0,

    serviceable: 0,
    unserviceable: 0,
    beyondEconomicRepair: 0,

    organic: 0,
    donated: 0,
    loaned: 0,

    goodMaintenance: 0,
    dueSoon: 0,
    overdue: 0,

    registrationDue: 0,
    registrationExpiringSoon: 0,
    registrationExpired: 0,

    insuranceDue: 0,
    insuranceExpiringSoon: 0,
    insuranceExpired: 0,
  });
  // const [upcomingMaintenance, setUpcomingMaintenance] = useState<any[]>([]);
  // const [vehicles, setVehicles] = useState<MobilityAsset[]>([]);
  const [vehicleStats, setVehicleStats] = useState<
    {
      type: string;
      total: number;
      serviceable: number;
      unserviceable: number;
      ber: number;
      organic: number;
      donated: number;
      loaned: number;
    }[]
  >([]);
  const { isAdmin, unitId } = useAuth();

  const [defectTrendData, setDefectTrendData] = useState<DefectTrendData[]>([]);
  const [defectItems, setDefectItems] = useState<
    Record<string, DefectItemData[]>
  >({});

  useEffect(() => {
    loadPage();
  }, [isAdmin, unitId]);

  const loadPage = async () => {
    setLoading(true);

    try {
      await Promise.all([loadMaintenanceStatus(), loadDefectTrends()]);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
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

    const typeStats = mobilityType.map((type) => {
      const vehicles = vehicleList.filter(
        (vehicle) => vehicle.vehicle_type === type,
      );

      return {
        type,
        total: vehicles.length,

        serviceable: vehicles.filter(
          (vehicle) => vehicle.status === "Serviceable",
        ).length,

        unserviceable: vehicles.filter(
          (vehicle) => vehicle.status === "Unserviceable",
        ).length,

        ber: vehicles.filter(
          (vehicle) =>
            vehicle.status === "Beyond Economic Repair" ||
            vehicle.status === "BER",
        ).length,

        organic: vehicles.filter((vehicle) => vehicle.source === "Organic")
          .length,
        donated: vehicles.filter((vehicle) => vehicle.source === "Donated")
          .length,
        loaned: vehicles.filter((vehicle) => vehicle.source === "Loaned")
          .length,
      };
    });

    // Sort by total vehicles — highest first
    typeStats.sort((a, b) => b.total - a.total);

    setVehicleStats(typeStats);

    let serviceable = 0;
    let unserviceable = 0;
    let beyondEconomicRepair = 0;

    let organic = 0;
    let loaned = 0;
    let donated = 0;

    let goodMaintenance = 0;
    let dueSoon = 0;
    let overdue = 0;

    let registrationDue = 0;
    let registrationExpiringSoon = 0;
    let registrationExpired = 0;

    let insuranceDue = 0;
    let insuranceExpiringSoon = 0;
    let insuranceExpired = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    //const upcoming: any[] = [];

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

      switch (vehicle.source) {
        case "Organic":
          organic++;
          break;

        case "Loaned":
          loaned++;
          break;

        case "Donated":
          donated++;
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
        expiry.setHours(0, 0, 0, 0);

        const daysRemaining = Math.ceil(
          (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysRemaining < 0) {
          // Already expired
          registrationExpired++;
        } else if (daysRemaining <= 30) {
          // Expires today or within the next 30 days
          registrationExpiringSoon++;
        }
      }

      registrationDue = registrationExpiringSoon + registrationExpired;

      if (vehicle.insurance_coverage_date) {
        const expiry = new Date(vehicle.insurance_coverage_date);
        expiry.setHours(0, 0, 0, 0);

        const daysRemaining = Math.ceil(
          (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysRemaining < 0) {
          insuranceExpired++;
        } else if (daysRemaining <= 30) {
          insuranceExpiringSoon++;
        }
      }

      insuranceDue = insuranceExpiringSoon + insuranceExpired;

      // reminders.forEach((reminder) => {
      //   const item = {
      //     plate_number: vehicle.plate_number,
      //     description: vehicle.description,
      //     unit_name: vehicle.unit?.unit_name,
      //     maintenance: reminder.maintenance_type_name,
      //     dueDate: reminder.next_service_date,
      //     dueOdometer: reminder.next_service_odometer,
      //     kmRemaining: reminder.km_remaining,
      //     daysRemaining: reminder.days_remaining,
      //     status: reminder.status,
      //   };

      //   upcoming.push(item);
      // });
    });

    // upcoming.sort((a, b) => {
    //   const aKm =
    //     a.kmRemaining == null ? Number.MAX_SAFE_INTEGER : a.kmRemaining;

    //   const bKm =
    //     b.kmRemaining == null ? Number.MAX_SAFE_INTEGER : b.kmRemaining;

    //   return aKm - bKm;
    // });

    setStatistics({
      totalVehicles: vehicleList.length,
      serviceable,
      unserviceable,
      beyondEconomicRepair,
      organic,
      loaned,
      donated,
      goodMaintenance,
      dueSoon,
      overdue,

      registrationDue,
      registrationExpiringSoon,
      registrationExpired,

      insuranceDue,
      insuranceExpiringSoon,
      insuranceExpired,
    });

    // setUpcomingMaintenance(upcoming.slice(0, 20));
  };

  const loadDefectTrends = async () => {
    setLoading(true);

    try {
      let query = supabase
        .from("vehicle_inspection_results")
        .select(
          `
        id,
        status,
        inspection_item:inspection_item_id(
          id,
          name,
          category:category_id(
            id,
            name
          )
        ),
        inspection:inspection_id(
          id,
          unit_id
        )
      `,
        )
        .eq("status", "UNCOMPLIED");

      const { data, error } = await query;

      if (error) throw error;

      const categoryMap: Record<
        string,
        {
          categoryId: string;
          categoryName: string;
          defectCount: number;
        }
      > = {};

      const itemMap: Record<
        string,
        {
          categoryId: string;
          itemId: string;
          itemName: string;
          defectCount: number;
        }
      > = {};

      data?.forEach((result: any) => {
        const item = result.inspection_item;

        if (!item) return;

        const category = item.category;

        if (!category) return;

        // -----------------------------------------
        // UNIT FILTER
        // -----------------------------------------

        if (!isAdmin && unitId) {
          const inspectionUnitId = result.inspection?.unit_id;

          if (inspectionUnitId !== unitId) {
            return;
          }
        }

        // -----------------------------------------
        // CATEGORY COUNT
        // -----------------------------------------

        if (!categoryMap[category.id]) {
          categoryMap[category.id] = {
            categoryId: category.id,
            categoryName: category.name,
            defectCount: 0,
          };
        }

        categoryMap[category.id].defectCount++;

        // -----------------------------------------
        // ITEM COUNT
        // -----------------------------------------

        if (!itemMap[item.id]) {
          itemMap[item.id] = {
            categoryId: category.id,
            itemId: item.id,
            itemName: item.name,
            defectCount: 0,
          };
        }

        itemMap[item.id].defectCount++;
      });

      // -----------------------------------------
      // SORT CATEGORIES
      // -----------------------------------------

      const categoryData = Object.values(categoryMap).sort(
        (a, b) => b.defectCount - a.defectCount,
      );

      // -----------------------------------------
      // GROUP ITEMS BY CATEGORY
      // -----------------------------------------

      const groupedItems: Record<string, DefectItemData[]> = {};

      Object.values(itemMap).forEach((item) => {
        if (!groupedItems[item.categoryId]) {
          groupedItems[item.categoryId] = [];
        }

        groupedItems[item.categoryId].push({
          itemId: item.itemId,
          itemName: item.itemName,
          defectCount: item.defectCount,
        });
      });

      // Sort items by highest defect count
      Object.values(groupedItems).forEach((items) => {
        items.sort((a, b) => b.defectCount - a.defectCount);
      });

      setDefectTrendData(categoryData);
      setDefectItems(groupedItems);
    } catch (error) {
      console.error("Failed to load inspection defect trends:", error);

      setDefectTrendData([]);
      setDefectItems({});
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <SectionTitle
        title="Mobility Dashboard"
        subtitle="Real-time monitoring of mobility assets, maintenance schedules, and inspections."
      />

      <div className="grid gap-6 grid-cols-2">
        {/* Mobility Reminders */}
        <div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 border-b pb-1 border-slate-200 dark:border-slate-800">
              Reminders
            </h2>
          </div>
          <div className="mt-5 grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3">
            <MobilityStatCard
              title="Due for Registration"
              value={statistics.registrationDue}
              bg_color="bg-amber-50 dark:bg-amber-950"
              border_color="border-amber-200 dark:border-amber-800"
              expiring_soon={statistics.registrationExpiringSoon}
              expired={statistics.registrationExpired}
            />

            <MobilityStatCard
              title="Renewal of Insurance"
              value={statistics.insuranceDue}
              bg_color="bg-sky-50 dark:bg-sky-950"
              border_color="border-sky-200 dark:border-sky-800"
              expiring_soon={statistics.insuranceExpiringSoon}
              expired={statistics.insuranceExpired}
            />

            <MobilityStatCard
              title="Due for PMS"
              value={statistics.dueSoon + statistics.overdue}
              bg_color="bg-slate-50 dark:bg-slate-950"
              border_color="border-slate-200 dark:border-slate-300"
              expiring_soon={statistics.dueSoon}
              expired={statistics.overdue}
            />
          </div>
        </div>
        {/* Maintenance/Status Statistics */}
        <div className="lg:border-l lg:border-gray-300 dark:lg:border-gray-700 lg:pl-8">
          <div>
            <h2 className="text-xl font-bold text-gray-800 border-b pb-1 border-slate-200 dark:border-slate-800">
              Total Mobility Assets and Status
            </h2>
          </div>
          <div className="mt-5 grid gap-6 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"
                />
              ))
            ) : (
              <>
                <MobilityStatCard
                  title="Total Mobility Assets"
                  value={statistics.totalVehicles}
                  bg_color="bg-slate-50 dark:bg-slate-950"
                  border_color="border-slate-200 dark:border-slate-800"
                />

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
                  title="BER"
                  value={statistics.beyondEconomicRepair}
                  bg_color="bg-red-50 dark:bg-red-950"
                  border_color="border-red-200 dark:border-red-800"
                />

                <MobilityStatCard
                  title="Organic"
                  value={statistics.organic}
                  bg_color="bg-slate-50 dark:bg-slate-950"
                  border_color="border-slate-200 dark:border-slate-800"
                />

                <MobilityStatCard
                  title="Donated"
                  value={statistics.donated}
                  bg_color="bg-slate-50 dark:bg-slate-950"
                  border_color="border-slate-200 dark:border-slate-800"
                />

                <MobilityStatCard
                  title="Loaned"
                  value={statistics.loaned}
                  bg_color="bg-slate-50 dark:bg-slate-950"
                  border_color="border-slate-200 dark:border-slate-800"
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobility Type Statistics */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 border-b pb-1 border-slate-200 dark:border-slate-800">
          Breakdown of Mobility Assets
        </h2>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-7">
        {loading
          ? Array.from({ length: mobilityType.length }).map((_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"
              />
            ))
          : vehicleStats.map((stats) => (
              <VehicleTypeCard
                key={stats.type}
                title={stats.type}
                total={stats.total}
                serviceable={stats.serviceable}
                unserviceable={stats.unserviceable}
                ber={stats.ber}
                organic={stats.organic}
                donated={stats.donated}
                loaned={stats.loaned}
              />
            ))}
      </div>
      <div className="grid gap-6">
        <DefectTrendChart
          data={defectTrendData}
          defectItems={defectItems}
          loading={loading}
        />
        {/* 
        <DashboardSection title="Upcoming Periodic Maintenance Service Schedule">
          <UpcomingMaintenanceTable data={upcomingMaintenance} />
        </DashboardSection> */}
      </div>
    </div>
  );
}
