import { useEffect, useRef, useState } from "react";
import { MobilityAsset, PatrolLog, Personnel, supabase } from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";
import { getMaintenanceReminders } from "../pages/utils/maintenanceStatus";

export interface PMSNotification {
  vehicle_id: string;
  plate_number: string;
  unit_name: string | null;

  maintenance_type_id: string;
  maintenance_type_name: string;

  next_service_date: string | null;
  next_service_odometer: number | null;

  current_odometer: number | null;

  days_remaining: number | null;
  km_remaining: number | null;

  status: "OVERDUE" | "DUE_SOON";
}

export function useVehicleRealtime() {
  const { unitId, isAdmin } = useAuth();

  // ============================
  // State
  // ============================

  const [vehicles, setVehicles] = useState<
    Record<string, MobilityAsset>
  >({});

  const [logs, setLogs] = useState<
    Record<string, PatrolLog>
  >({});

  const [personnel, setPersonnel] = useState<
    Record<string, Personnel>
  >({});

  const [notificationCounts, setNotificationCounts] = useState({
    overdue: 0,
    dueSoon: 0,
  });

  const [pmsNotifications, setPmsNotifications] = useState<
    PMSNotification[]
  >([]);

  // ============================
  // Refs
  // ============================

  const vehiclesRef = useRef<
    Record<string, MobilityAsset>
  >({});

  const personnelRef = useRef<
    Record<string, Personnel>
  >({});

  const logsRef = useRef<
    Record<string, PatrolLog>
  >({});

  useEffect(() => {
    vehiclesRef.current = vehicles;
  }, [vehicles]);

  useEffect(() => {
    personnelRef.current = personnel;
  }, [personnel]);

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  // =====================================================
  // LOAD NOTIFICATION COUNTS
  // =====================================================

  const loadNotificationCounts = async (
    currentVehicles?: Record<string, MobilityAsset>,
  ) => {
    try {
      const vehicleMap = currentVehicles ?? vehiclesRef.current;

      const vehicleIds = Object.keys(vehicleMap);

      if (vehicleIds.length === 0) {
        setNotificationCounts({
          overdue: 0,
          dueSoon: 0,
        });

        setPmsNotifications([]);

        return;
      }

      //-----------------------------------------
      // Load Maintenance History
      //-----------------------------------------

      const { data: maintenanceData, error } = await supabase
        .from("mobility_assets_maintenance_history")
        .select(`
        *,
        items:mobility_assets_maintenance_history_items(
          *,
          maintenance_type:maintenance_types(*)
        )
      `)
        .in("mobility_asset_id", vehicleIds)
        .order("changed_at", {
          ascending: false,
        });

      if (error) throw error;

      //-----------------------------------------
      // Track VEHICLES for counts
      //-----------------------------------------

      const overdueVehicles = new Set<string>();
      const dueSoonVehicles = new Set<string>();

      //-----------------------------------------
      // Detailed PMS notifications
      //-----------------------------------------

      const notifications: PMSNotification[] = [];

      //-----------------------------------------
      // Calculate reminders per vehicle
      //-----------------------------------------

      Object.values(vehicleMap).forEach((vehicle) => {
        //-----------------------------------------
        // Unit filtering
        //-----------------------------------------

        if (
          !isAdmin &&
          unitId &&
          vehicle.unit_id !== unitId
        ) {
          return;
        }

        //-----------------------------------------
        // Get this vehicle's maintenance history
        //-----------------------------------------

        const histories = maintenanceData?.filter(
          (history) => history.mobility_asset_id === vehicle.id,
        ) ?? [];

        if (histories.length === 0) {
          return;
        }

        //-----------------------------------------
        // Use your EXISTING PMS calculation
        //-----------------------------------------

        const reminders = getMaintenanceReminders(
          histories,
          Number(vehicle.current_odometer ?? 0),
        );

        //-----------------------------------------
        // Process reminders
        //-----------------------------------------

        reminders.forEach((reminder: any) => {
          //---------------------------------------
          // Count vehicles
          //---------------------------------------

          if (reminder.status === "OVERDUE") {
            overdueVehicles.add(vehicle.id);
          }

          if (reminder.status === "DUE_SOON") {
            dueSoonVehicles.add(vehicle.id);
          }

          //---------------------------------------
          // Only show actionable notifications
          //---------------------------------------

          if (
            reminder.status !== "OVERDUE" &&
            reminder.status !== "DUE_SOON"
          ) {
            return;
          }

          //---------------------------------------
          // Add vehicle information
          //---------------------------------------

          notifications.push({
            vehicle_id: vehicle.id,

            plate_number: vehicle.plate_number,

            unit_name: vehicle.unit?.unit_name ?? null,

            maintenance_type_id: reminder.maintenance_type_id,

            maintenance_type_name: reminder.maintenance_type_name,

            next_service_date: reminder.next_service_date ?? null,

            next_service_odometer: reminder.next_service_odometer != null
              ? Number(
                reminder.next_service_odometer,
              )
              : null,

            current_odometer: Number(
              vehicle.current_odometer ?? 0,
            ),

            days_remaining: reminder.days_remaining ?? null,

            km_remaining: reminder.km_remaining ?? null,

            status: reminder.status,
          });
        });
      });

      //-----------------------------------------
      // Sort notifications
      //-----------------------------------------

      notifications.sort((a, b) => {
        const priority = {
          OVERDUE: 0,
          DUE_SOON: 1,
        };

        return priority[a.status] - priority[b.status];
      });

      //-----------------------------------------
      // Update counts
      //-----------------------------------------

      setNotificationCounts({
        overdue: overdueVehicles.size,
        dueSoon: dueSoonVehicles.size,
      });

      //-----------------------------------------
      // Update detailed notifications
      //-----------------------------------------

      setPmsNotifications(notifications);
    } catch (error) {
      console.error(
        "Failed to load notification counts:",
        error,
      );
    }
  };

  // =====================================================
  // LOAD INITIAL DATA
  // =====================================================

  useEffect(() => {
    let cancelled = false;

    const loadInitialData = async () => {
      try {
        //-----------------------------------------
        // Load Vehicles
        //-----------------------------------------

        let vehicleQuery = supabase
          .from("mobility_assets")
          .select("*, unit(*)");

        if (!isAdmin && unitId) {
          vehicleQuery = vehicleQuery.eq(
            "unit_id",
            unitId,
          );
        }

        const {
          data: vehicleData,
          error: vehicleError,
        } = await vehicleQuery;

        if (vehicleError) throw vehicleError;

        //-----------------------------------------
        // Convert Vehicles to Map
        //-----------------------------------------

        const vehicleMap: Record<
          string,
          MobilityAsset
        > = {};

        vehicleData?.forEach((vehicle) => {
          vehicleMap[vehicle.id] = vehicle;
        });

        //-----------------------------------------
        // Load Personnel
        //-----------------------------------------

        let personnelQuery = supabase
          .from("personnel")
          .select("*, unit(*)");

        if (!isAdmin && unitId) {
          personnelQuery = personnelQuery.eq(
            "unit_id",
            unitId,
          );
        }

        const {
          data: personnelData,
          error: personnelError,
        } = await personnelQuery;

        if (personnelError) throw personnelError;

        //-----------------------------------------
        // Convert Personnel to Map
        //-----------------------------------------

        const personnelMap: Record<
          string,
          Personnel
        > = {};

        personnelData?.forEach((member) => {
          personnelMap[member.id] = member;
        });

        //-----------------------------------------
        // Update State
        //-----------------------------------------

        if (!cancelled) {
          setVehicles(vehicleMap);
          setPersonnel(personnelMap);
        }

        //-----------------------------------------
        // Load Notification Counts
        //-----------------------------------------

        if (!cancelled) {
          await loadNotificationCounts(vehicleMap);
        }

        //-----------------------------------------
        // Load Latest Logs
        //-----------------------------------------

        const twoDaysAgo = new Date();

        twoDaysAgo.setDate(
          twoDaysAgo.getDate() - 10,
        );

        const {
          data: logData,
          error: logError,
        } = await supabase
          .from("latest_asset_logs")
          .select("*")
          .not(
            "duty_type",
            "ilike",
            "Intel-Driven Operation",
          )
          .not(
            "duty_type",
            "ilike",
            "Special Laws",
          )
          .gt(
            "captured_at",
            twoDaysAgo.toISOString(),
          );

        if (logError) throw logError;

        const latestLogs: Record<
          string,
          PatrolLog
        > = {};

        logData?.forEach((log) => {
          const trackingKey = log.vehicle_id ?? log.personnel_id;

          if (!trackingKey) return;

          const lat = Number(log.latitude);
          const lng = Number(log.longitude);

          if (
            Number.isNaN(lat) ||
            Number.isNaN(lng)
          ) {
            return;
          }

          if (!isAdmin && unitId) {
            if (log.vehicle_id) {
              const vehicle = vehicleMap[log.vehicle_id];

              if (
                !vehicle ||
                vehicle.unit_id !== unitId
              ) {
                return;
              }
            }

            if (log.personnel_id) {
              const officer = personnelMap[log.personnel_id];

              if (
                !officer ||
                officer.unit_id !== unitId
              ) {
                return;
              }
            }
          }

          const existing = latestLogs[trackingKey];

          if (
            !existing ||
            new Date(log.captured_at) >
              new Date(existing.captured_at)
          ) {
            latestLogs[trackingKey] = log;
          }
        });

        if (!cancelled) {
          setLogs(latestLogs);
        }
      } catch (err) {
        console.error(
          "Realtime initialization failed:",
          err,
        );
      }
    };

    loadInitialData();

    // =====================================================
    // REALTIME SUBSCRIPTIONS
    // =====================================================

    const vehiclesChannel = supabase
      .channel("mobility-assets-realtime")
      // ==========================================
      // VEHICLE INSERT
      // ==========================================

      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mobility_assets",
        },
        ({ new: newVehicle }) => {
          const vehicle = newVehicle as MobilityAsset;

          if (
            !isAdmin &&
            unitId &&
            vehicle.unit_id !== unitId
          ) {
            return;
          }

          setVehicles((prev) => ({
            ...prev,
            [vehicle.id]: vehicle,
          }));

          // Refresh notifications
          loadNotificationCounts({
            ...vehiclesRef.current,
            [vehicle.id]: vehicle,
          });
        },
      )
      // ==========================================
      // VEHICLE UPDATE
      // ==========================================

      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "mobility_assets",
        },
        ({ new: updatedVehicle }) => {
          const vehicle = updatedVehicle as MobilityAsset;

          if (
            !isAdmin &&
            unitId &&
            vehicle.unit_id !== unitId
          ) {
            setVehicles((prev) => {
              const clone = { ...prev };

              delete clone[vehicle.id];

              return clone;
            });

            loadNotificationCounts(
              vehiclesRef.current,
            );

            return;
          }

          const updatedVehicles = {
            ...vehiclesRef.current,
            [vehicle.id]: vehicle,
          };

          setVehicles(updatedVehicles);

          // Important:
          // current_odometer changes can change PMS status.
          loadNotificationCounts(
            updatedVehicles,
          );
        },
      )
      // ==========================================
      // VEHICLE DELETE
      // ==========================================

      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "mobility_assets",
        },
        ({ old }) => {
          const vehicle = old as MobilityAsset;

          const updatedVehicles = {
            ...vehiclesRef.current,
          };

          delete updatedVehicles[vehicle.id];

          setVehicles(updatedVehicles);

          loadNotificationCounts(
            updatedVehicles,
          );
        },
      )
      // ==========================================
      // MAINTENANCE HISTORY CHANGES
      // ==========================================

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mobility_assets_maintenance_history",
        },
        () => {
          loadNotificationCounts(
            vehiclesRef.current,
          );
        },
      )
      .subscribe();

    // =====================================================
    // PATROL LOG REALTIME
    // =====================================================

    const patrolChannel = supabase
      .channel("patrol-logs-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "patrol_logs",
        },
        ({ new: inserted }) => {
          const log = inserted as PatrolLog;

          //------------------------------------------
          // Validate Coordinates
          //------------------------------------------

          const lat = Number(log.latitude);
          const lng = Number(log.longitude);

          if (
            Number.isNaN(lat) ||
            Number.isNaN(lng)
          ) {
            return;
          }

          //------------------------------------------
          // Vehicle OR Foot Patrol
          //------------------------------------------

          const trackingKey = log.vehicle_id ??
            log.personnel_id;

          if (!trackingKey) {
            return;
          }

          //------------------------------------------
          // Unit Filtering
          //------------------------------------------

          if (!isAdmin && unitId) {
            if (log.vehicle_id) {
              const vehicle = vehiclesRef.current[
                log.vehicle_id
              ];

              if (
                !vehicle ||
                vehicle.unit_id !== unitId
              ) {
                return;
              }
            }

            if (log.personnel_id) {
              const officer = personnelRef.current[
                log.personnel_id
              ];

              if (
                !officer ||
                officer.unit_id !== unitId
              ) {
                return;
              }
            }
          }

          //------------------------------------------
          // Update only if newer
          //------------------------------------------

          setLogs((prev) => {
            const existing = prev[trackingKey];

            if (
              existing &&
              new Date(existing.captured_at) >=
                new Date(log.captured_at)
            ) {
              return prev;
            }

            return {
              ...prev,
              [trackingKey]: log,
            };
          });
        },
      )
      .subscribe();

    // =====================================================
    // CLEANUP
    // =====================================================

    return () => {
      cancelled = true;

      supabase.removeChannel(
        vehiclesChannel,
      );

      supabase.removeChannel(
        patrolChannel,
      );
    };
  }, [isAdmin, unitId]);

  // =====================================================
  // RETURN
  // =====================================================

  return {
    vehicles,
    logs,
    personnel,
    notificationCounts,
    pmsNotifications,
  };
}
