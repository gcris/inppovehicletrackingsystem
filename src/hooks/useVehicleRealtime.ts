import { useEffect, useState } from "react";
import { supabase, Vehicle, VehicleLog, isMock } from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";

export function useVehicleRealtime() {
  const [vehicles, setVehicles] = useState<Record<string, Vehicle>>({});
  const [logs, setLogs] = useState<Record<string, VehicleLog>>({});
  const { unitId, isAdmin } = useAuth();

  useEffect(() => {
    // Initial fetch of active vehicles and their latest logs
    const fetchInitialData = async () => {
      try {
        // Build query with unit filtering for non-admin users
        let vehiclesQuery = supabase.from("vehicles").select("*");

        // Apply unit filtering for non-admin users
        if (!isAdmin && unitId) {
          vehiclesQuery = vehiclesQuery.eq("unit_id", unitId);
        }

        const { data: vehicleData, error: vError } = await vehiclesQuery;

        if (vError) throw vError;
        if (vehicleData) {
          const vehicleMap = vehicleData.reduce(
            (acc, v) => ({ ...acc, [v.id]: v }),
            {},
          );
          setVehicles(vehicleMap);
        }

        // Build logs query with unit filtering for non-admin users
        let logsQuery = supabase
          .from("vehicle_logs")
          .select("*")
          .order("captured_at", { ascending: false })
          .limit(1000); // Increased limit as guard rails

        // For non-admin users, we need to join with vehicles table to filter by unit_id
        if (!isAdmin && unitId) {
          logsQuery = supabase
            .from("vehicle_logs")
            .select("*, vehicles(unit_id)")
            .order("captured_at", { ascending: false })
            .limit(1000);
        }

        const { data: logData, error: lError } = await logsQuery;

        if (lError) throw lError;
        if (logData) {
          // Filter logs to only include those from user's unit (for non-admin)
          let filteredLogData = logData;
          if (!isAdmin && unitId) {
            filteredLogData = logData.filter(log =>
              log.vehicles && log.vehicles.unit_id === unitId
            );
          }

          const latestLogs: Record<string, VehicleLog> = {};
          filteredLogData.forEach((log: VehicleLog) => {
            // Safeguard against invalid coordinates
            const lat = Number(log.latitude);
            const lng = Number(log.longitude);
            if (!isNaN(lat) && !isNaN(lng) && !latestLogs[log.vehicle_id]) {
              latestLogs[log.vehicle_id] = log;
            }
          });
          setLogs(latestLogs);
        }
      } catch (err) {
        console.error("Error fetching vehicle data:", err);
      }
    };

    fetchInitialData();

    // Subscribe to real-time updates for vehicle logs with a unique channel name to avoid collisions
    if (isMock) {
      console.log("[useVehicleRealtime] Realtime subscriptions disabled in mock mode.");
      return;
    }

    const channelId = Math.random().toString(36).slice(2);
    const channel = supabase
      .channel(`vehicle-tracking-${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vehicle_logs" },
        (payload) => {
          const newLog = payload.new as VehicleLog;
          // Filter logs to only include those from user's unit (for non-admin)
          if (!isAdmin && unitId) {
            // We need to check if the new log's vehicle belongs to the user's unit
            // Since the payload doesn't include joined data, we'll fetch the vehicle info
            supabase
              .from("vehicles")
              .select("unit_id")
              .eq("id", newLog.vehicle_id)
              .single()
              .then(({ data: vehicle, error }) => {
                if (!error && vehicle && vehicle.unit_id === unitId) {
                  const lat = Number(newLog.latitude);
                  const lng = Number(newLog.longitude);
                  if (!isNaN(lat) && !isNaN(lng)) {
                    setLogs((prev) => ({
                      ...prev,
                      [newLog.vehicle_id]: newLog,
                    }));
                  }
                }
              });
          } else {
            // Admin users see all logs
            const lat = Number(newLog.latitude);
            const lng = Number(newLog.longitude);
            if (!isNaN(lat) && !isNaN(lng)) {
              setLogs((prev) => ({
                ...prev,
                [newLog.vehicle_id]: newLog,
              }));
            }
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "vehicles" },
        (payload) => {
          const updatedVehicle = payload.new as Vehicle;
          // For non-admin users, only update vehicles from their unit
          if (!isAdmin && unitId) {
            if (updatedVehicle.unit_id === unitId) {
              setVehicles((prev) => ({
                ...prev,
                [updatedVehicle.id]: updatedVehicle,
              }));
            }
          } else {
            // Admin users see all vehicles
            setVehicles((prev) => ({
              ...prev,
              [updatedVehicle.id]: updatedVehicle,
            }));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch((err) => {
        console.warn("Realtime channel cleanup warning:", err);
      });
    };
  }, [isAdmin, unitId]);

  return { vehicles, logs };
}
