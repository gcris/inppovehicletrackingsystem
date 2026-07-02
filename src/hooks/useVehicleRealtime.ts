import { useEffect, useState } from "react";
import { supabase, MobilityAsset, PatrolLog, Personnel } from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";

export function useVehicleRealtime() {
  const [vehicles, setVehicles] = useState<Record<string, MobilityAsset>>({});
  const [logs, setLogs] = useState<Record<string, PatrolLog>>({});
  const [personnel, setPersonnel] = useState<Record<string, Personnel>>({});
  const { unitId, isAdmin } = useAuth();

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch mobility assets first to get the vehicle ids we care about
        let vehiclesQuery = supabase
          .from("mobility_assets")
          .select("*, unit(*)");
        let personnelQuery = supabase.from("personnel").select("*, unit(*)");

        if (!isAdmin && unitId) {
          vehiclesQuery = vehiclesQuery.eq("unit_id", unitId);
          personnelQuery = personnelQuery.eq("unit_id", unitId);
        }
        const { data: vehicleData, error: vError } = await vehiclesQuery;
        const { data: personnelData, error: pError } = await personnelQuery;
        if (vError) throw vError;
        if (pError) throw pError;
        // Set vehicles state
        if (vehicleData) {
          const vehicleMap = vehicleData.reduce(
            (acc, v) => ({ ...acc, [v.id]: v }),
            {},
          );
          setVehicles(vehicleMap);
        }

        // Set personnel state
        if (personnelData) {
          const personnelMap = personnelData.reduce(
            (acc, p) => ({ ...acc, [p.id]: p }),
            {},
          );
          setPersonnel(personnelMap);
        }

        // Get vehicle ids for filtering logs
        const vehicleIds = vehicleData?.map((v) => v.id) || [];
        console.log("vehicleIds: ", vehicleIds);
        const personnelIds = personnelData?.map((p) => p.id) || [];

        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const timeLimitIsoString = twoDaysAgo.toISOString();

        // Fetch vehicle logs
        let logsQuery = supabase.from("latest_asset_logs").select("*"); //.gt("captured_at", timeLimitIsoString)  ;

        if (!isAdmin && unitId) {
          const orConditions = [];
          // FIX 1: Only exit early if BOTH asset arrays are completely empty
          if (vehicleIds.length === 0 && personnelIds.length === 0) {
            setLogs({});
            return;
          }

          // FIX 2: Use a clean .join(",") without mapping double quotes around UUIDs
          if (vehicleIds.length > 0) {
            const vehicleStr = vehicleIds.join(",");
            orConditions.push(`vehicle_id.in.(${vehicleStr})`);
          }

          if (personnelIds.length > 0) {
            const personnelStr = personnelIds.join(",");
            orConditions.push(`personnel_id.in.(${personnelStr})`);
          }

          if (orConditions.length > 0) {
            logsQuery = logsQuery.or(orConditions.join(","));
          }
        }

        const { data: logData, error: lError } = await logsQuery;
        if (lError) throw lError;

        const latestLogs: Record<string, PatrolLog> = {};

        if (logData) {
          logData.forEach((log: PatrolLog) => {
            const lat = Number(log.latitude);
            const lng = Number(log.longitude);

            // Skip if coordinates are invalid
            if (isNaN(lat) || isNaN(lng)) {
              return;
            }

            // 1. Generate a unique key: use vehicle_id if available, fallback to personnel_id for foot patrols
            const trackingKey = log.vehicle_id || log.personnel_id;

            // Safety check: skip if the log somehow lacks both identifiers
            if (!trackingKey) {
              return;
            }

            // 2. Use the trackingKey instead of log.vehicle_id
            const existingLog = latestLogs[trackingKey];

            // Update if no existing log or if new log is more recent
            if (
              !existingLog ||
              new Date(log.captured_at) > new Date(existingLog.captured_at)
            ) {
              latestLogs[trackingKey] = log;
            }
          });
        }

        setLogs(latestLogs);
        console.log(latestLogs);
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
                setVehicles((prev) => ({
                  ...prev,
                  [newVehicle.id]: newVehicle,
                }));
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
        { event: "INSERT", schema: "public", table: "patrol_logs" },
        (payload) => {
          try {
            const newLog = payload.new as PatrolLog;
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
            console.error("Error in patrol_logs INSERT handler:", err);
          }
        },
      )
      // Note: We are not handling UPDATE or DELETE for patrol_logs as the table is assumed to be append-only.
      // If updates or deletes are possible, we should add handlers for them.
      .subscribe();

    // Cleanup subscriptions
    return () => {
      supabase.removeChannel(vehiclesChannel);
      supabase.removeChannel(logsChannel);
    };
  }, [isAdmin, unitId]); // Re-run effect if isAdmin or unitId changes

  return { vehicles, logs, personnel };
}
