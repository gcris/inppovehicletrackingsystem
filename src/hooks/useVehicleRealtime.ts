import { useEffect, useRef, useState } from "react";
import { supabase, MobilityAsset, PatrolLog, Personnel } from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";

export function useVehicleRealtime() {
  const { unitId, isAdmin } = useAuth();

  // ============================
  // State
  // ============================

  const [vehicles, setVehicles] = useState<Record<string, MobilityAsset>>({});

  const [logs, setLogs] = useState<Record<string, PatrolLog>>({});

  const [personnel, setPersonnel] = useState<Record<string, Personnel>>({});

  // ============================
  // Refs (always latest state)
  // ============================

  const vehiclesRef = useRef<Record<string, MobilityAsset>>({});

  const personnelRef = useRef<Record<string, Personnel>>({});

  const logsRef = useRef<Record<string, PatrolLog>>({});

  useEffect(() => {
    vehiclesRef.current = vehicles;
  }, [vehicles]);

  useEffect(() => {
    personnelRef.current = personnel;
  }, [personnel]);

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  // ============================
  // Load Initial Data
  // ============================

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
          vehicleQuery = vehicleQuery.eq("unit_id", unitId);
        }

        const { data: vehicleData, error: vehicleError } = await vehicleQuery;

        if (vehicleError) throw vehicleError;

        //-----------------------------------------
        // Load Personnel
        //-----------------------------------------

        let personnelQuery = supabase.from("personnel").select("*, unit(*)");

        if (!isAdmin && unitId) {
          personnelQuery = personnelQuery.eq("unit_id", unitId);
        }

        const { data: personnelData, error: personnelError } =
          await personnelQuery;

        if (personnelError) throw personnelError;

        //-----------------------------------------
        // Convert to Maps
        //-----------------------------------------

        const vehicleMap: Record<string, MobilityAsset> = {};

        vehicleData?.forEach((vehicle) => {
          vehicleMap[vehicle.id] = vehicle;
        });

        const personnelMap: Record<string, Personnel> = {};

        personnelData?.forEach((member) => {
          personnelMap[member.id] = member;
        });

        if (!cancelled) {
          setVehicles(vehicleMap);
          setPersonnel(personnelMap);
        }

        //-----------------------------------------
        // Load Latest Logs
        //-----------------------------------------

        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        let logQuery = supabase
          .from("latest_asset_logs")
          .select("*")
          .gt("captured_at", twoDaysAgo.toISOString());

        const { data: logData, error: logError } = await logQuery;

        if (logError) throw logError;

        const latestLogs: Record<string, PatrolLog> = {};

        logData?.forEach((log) => {
          const trackingKey = log.vehicle_id ?? log.personnel_id;

          if (!trackingKey) return;

          const lat = Number(log.latitude);
          const lng = Number(log.longitude);

          if (Number.isNaN(lat) || Number.isNaN(lng)) {
            return;
          }

          if (!isAdmin && unitId) {
            if (log.vehicle_id) {
              const vehicle = vehicleMap[log.vehicle_id];

              if (!vehicle || vehicle.unit_id !== unitId) {
                return;
              }
            }

            if (log.personnel_id) {
              const officer = personnelMap[log.personnel_id];

              if (!officer || officer.unit_id !== unitId) {
                return;
              }
            }
          }

          const existing = latestLogs[trackingKey];

          if (
            !existing ||
            new Date(log.captured_at) > new Date(existing.captured_at)
          ) {
            latestLogs[trackingKey] = log;
          }
        });

        if (!cancelled) {
          setLogs(latestLogs);
        }
      } catch (err) {
        console.error("Realtime initialization failed:", err);
      }
    };

    loadInitialData();

    // =====================================================
    // REALTIME SUBSCRIPTIONS
    // =====================================================

    const vehiclesChannel = supabase
      .channel("mobility-assets-realtime")

      //------------------------------------------
      // VEHICLE INSERT
      //------------------------------------------

      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mobility_assets",
        },
        ({ new: newVehicle }) => {
          const vehicle = newVehicle as MobilityAsset;

          if (!isAdmin && unitId && vehicle.unit_id !== unitId) {
            return;
          }

          setVehicles((prev) => ({
            ...prev,
            [vehicle.id]: vehicle,
          }));
        },
      )

      //------------------------------------------
      // VEHICLE UPDATE
      //------------------------------------------

      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "mobility_assets",
        },
        ({ new: updatedVehicle }) => {
          const vehicle = updatedVehicle as MobilityAsset;

          if (!isAdmin && unitId && vehicle.unit_id !== unitId) {
            setVehicles((prev) => {
              const clone = { ...prev };
              delete clone[vehicle.id];
              return clone;
            });

            return;
          }

          setVehicles((prev) => ({
            ...prev,
            [vehicle.id]: vehicle,
          }));
        },
      )

      //------------------------------------------
      // VEHICLE DELETE
      //------------------------------------------

      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "mobility_assets",
        },
        ({ old }) => {
          const vehicle = old as MobilityAsset;

          setVehicles((prev) => {
            const clone = { ...prev };
            delete clone[vehicle.id];
            return clone;
          });
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

          if (Number.isNaN(lat) || Number.isNaN(lng)) {
            return;
          }

          //------------------------------------------
          // Support Vehicle OR Foot Patrol
          //------------------------------------------

          const trackingKey = log.vehicle_id ?? log.personnel_id;

          if (!trackingKey) {
            return;
          }

          //------------------------------------------
          // Unit Filtering
          //------------------------------------------

          if (!isAdmin && unitId) {
            if (log.vehicle_id) {
              const vehicle = vehiclesRef.current[log.vehicle_id];

              if (!vehicle || vehicle.unit_id !== unitId) {
                return;
              }
            }

            if (log.personnel_id) {
              const officer = personnelRef.current[log.personnel_id];

              if (!officer || officer.unit_id !== unitId) {
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
              new Date(existing.captured_at) >= new Date(log.captured_at)
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

      supabase.removeChannel(vehiclesChannel);
      supabase.removeChannel(patrolChannel);
    };
  }, [isAdmin, unitId]);

  // =====================================================
  // RETURN
  // =====================================================

  return {
    vehicles,
    logs,
    personnel,
  };
}
