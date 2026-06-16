import { useEffect, useState } from "react";
import {
  supabase,
  MobilityAsset,
  VehicleLog,
} from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";

export function useVehicleRealtime() {
  const [vehicles, setVehicles] = useState<Record<string, MobilityAsset>>({});
  const [logs, setLogs] = useState<Record<string, VehicleLog>>({});
  const { unitId, isAdmin } = useAuth();

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch mobility assets first to get the vehicle ids we care about
        let vehiclesQuery = supabase.from("mobility_assets").select("*");
        if (!isAdmin && unitId) {
          vehiclesQuery = vehiclesQuery.eq("unit_id", unitId);
        }
        const { data: vehicleData, error: vError } = await vehiclesQuery;
        if (vError) throw vError;
        // Set vehicles state
        if (vehicleData) {
          const vehicleMap = vehicleData.reduce(
            (acc, v) => ({ ...acc, [v.id]: v }),
            {},
          );
          setVehicles(vehicleMap);
        }

        // Get vehicle ids for filtering logs
        const vehicleIds = vehicleData?.map(v => v.id) || [];

        // Fetch vehicle logs
        let logsQuery = supabase.from("vehicle_logs").select("*").order("captured_at", { ascending: false });
        // Note: Removed limit to avoid missing latest logs for vehicles beyond the limit.
        // This may fetch many logs if there are many vehicles and frequent logging.
        // Consider implementing pagination or a more efficient query if performance becomes an issue.
        if (!isAdmin && unitId) {
          if (vehicleIds.length === 0) {
            // No vehicles in unit, so no logs
            // Set logs to empty object and return early
            setLogs({});
            return;
          }
          logsQuery = logsQuery.in("vehicle_id", vehicleIds);
        }
        const { data: logData, error: lError } = await logsQuery;
        if (lError) throw lError;

        // Process logs to get the latest log per vehicle
        const latestLogs: Record<string, VehicleLog> = {};
        if (logData) {
          logData.forEach((log: VehicleLog) => {
            const lat = Number(log.latitude);
            const lng = Number(log.longitude);
            // Skip if coordinates are invalid
            if (isNaN(lat) || isNaN(lng)) {
              return;
            }
            // Update if no existing log or if new log is more recent
            const existingLog = latestLogs[log.vehicle_id];
            if (!existingLog || log.captured_at > existingLog.captured_at) {
              latestLogs[log.vehicle_id] = log;
            }
          });
        }
        setLogs(latestLogs);
      } catch (err) {
        console.error("Error fetching initial data:", err);
      }
    };

    fetchInitialData();

    // Subscribe to real-time updates for mobility assets
    const vehiclesChannel = supabase
      .channel(`mobility-assets-changes`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mobility_assets" },
        (payload) => {
          try {
            const newVehicle = payload.new as MobilityAsset;
            if (!isAdmin && unitId) {
              if (newVehicle.unit_id === unitId) {
                setVehicles((prev) => ({ ...prev, [newVehicle.id]: newVehicle }));
              }
            } else {
              setVehicles((prev) => ({ ...prev, [newVehicle.id]: newVehicle }));
            }
          } catch (err) {
            console.error("Error in mobility_assets INSERT handler:", err);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mobility_assets" },
        (payload) => {
          try {
            const updatedVehicle = payload.new as MobilityAsset;
            if (!isAdmin && unitId) {
              if (updatedVehicle.unit_id === unitId) {
                setVehicles((prev) => ({
                  ...prev,
                  [updatedVehicle.id]: updatedVehicle,
                }));
              } else {
                // Remove if no longer in unit
                setVehicles((prev) => {
                  const { [updatedVehicle.id]: removed, ...rest } = prev;
                  return rest;
                });
              }
            } else {
              setVehicles((prev) => ({
                ...prev,
                [updatedVehicle.id]: updatedVehicle,
              }));
            }
          } catch (err) {
            console.error("Error in mobility_assets UPDATE handler:", err);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "mobility_assets" },
        (payload) => {
          try {
            const deletedVehicle = payload.old as MobilityAsset;
            setVehicles((prev) => {
              const { [deletedVehicle.id]: removed, ...rest } = prev;
              return rest;
            });
          } catch (err) {
            console.error("Error in mobility_assets DELETE handler:", err);
          }
        },
      )
      .subscribe();

    // Subscribe to real-time updates for vehicle logs
    const logsChannel = supabase
      .channel(`vehicle-logs-changes`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vehicle_logs" },
        (payload) => {
          try {
            const newLog = payload.new as VehicleLog;
            const lat = Number(newLog.latitude);
            const lng = Number(newLog.longitude);
            // Skip if coordinates are invalid
            if (isNaN(lat) || isNaN(lng)) {
              return;
            }
            if (!isAdmin && unitId) {
              // Check if the vehicle belongs to the user's unit using the vehicles state
              const vehicle = vehicles[newLog.vehicle_id];
              if (vehicle && vehicle.unit_id === unitId) {
                // Update if no existing log or if new log is more recent
                const existingLog = logs[newLog.vehicle_id];
                if (
                  !existingLog ||
                  newLog.captured_at > existingLog.captured_at
                ) {
                  setLogs((prev) => ({
                    ...prev,
                    [newLog.vehicle_id]: newLog,
                  }));
                }
              }
              // If vehicle is not in state, we assume it's not in our unit (or we haven't received it yet).
              // We rely on the mobility_assets subscription to eventually bring the vehicle into state.
            } else {
              // Admin sees all logs
              // Update if no existing log or if new log is more recent
              const existingLog = logs[newLog.vehicle_id];
              if (
                !existingLog ||
                newLog.captured_at > existingLog.captured_at
              ) {
                setLogs((prev) => ({
                  ...prev,
                  [newLog.vehicle_id]: newLog,
                }));
              }
            }
          } catch (err) {
            console.error("Error in vehicle_logs INSERT handler:", err);
          }
        },
      )
      // Note: We are not handling UPDATE or DELETE for vehicle_logs as the table is assumed to be append-only.
      // If updates or deletes are possible, we should add handlers for them.
      .subscribe();

    // Cleanup subscriptions
    return () => {
      supabase.removeChannel(vehiclesChannel);
      supabase.removeChannel(logsChannel);
    };
  }, [isAdmin, unitId]); // Re-run effect if isAdmin or unitId changes

  return { vehicles, logs };
}
