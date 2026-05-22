import { useEffect, useState } from "react";
import { supabase, Vehicle, VehicleLog } from "../lib/supabase";

const enable_simulation = true; // Set to true to enable simulated data for testing without real database connection

export function useVehicleRealtime() {
  const [vehicles, setVehicles] = useState<Record<string, Vehicle>>({});
  const [logs, setLogs] = useState<Record<string, VehicleLog>>({});

  useEffect(() => {
    if (enable_simulation) {
      const vehicle_id = "eeca1d4a-67bf-46b4-b10c-d19602ca5aba";

      const runDbSimulation = async () => {
        try {
          const { data: vehicleData, error: vError } = await supabase
            .from("vehicles")
            .select("*")
            .eq("id", vehicle_id)
            .single();

          if (vError) throw vError;

          setVehicles({ [vehicleData.id]: vehicleData });

          const start = "2026-05-21 06:21:59.114992+08";
          const end = "2026-05-21 09:30:05.853061+08";

          const { data: logData, error: lError } = await supabase
            .from("vehicle_logs")
            .select("*")
            .eq("vehicle_id", vehicle_id)
            .gte("captured_at", start)
            .lte("captured_at", end)
            .order("captured_at", { ascending: true });

          if (lError) throw lError;

          let logIndex = 0;

          // Simulan ang pag-loop sa mga nakuha nating totoong logs
          const intervalId = setInterval(() => {
            const currentMockLog = logData[logIndex];

            if (currentMockLog) {
              setLogs((prev) => ({
                ...prev,
                [vehicle_id]: {
                  ...currentMockLog,
                  // Pinapalitan natin ang timestamp para isipin ng frontend na "kakapasok lang" ng data ngayon
                  captured_at: new Date().toISOString(),
                },
              }));

              console.log(
                `Simulating Point ${logIndex + 1}/${logData.length}: Lat: ${currentMockLog.latitude}, Lng: ${currentMockLog.longitude}`,
              );

              // Lipat sa susunod na coordinate sa listahan
              logIndex++;

              // Kung umabot na sa dulo ng ruta, bumalik sa simula (Infinite Loop)
              if (logIndex >= logData.length) {
                logIndex = 0;
              }
            }
          }, 3000); // Mag-mu-move sa susunod na totoong tuldok bawat 3 segundo

          return intervalId;
        } catch (error) {
          console.error("Error fetching simulated vehicle data:", error);
        }
      };

      let activeInterval: ReturnType<typeof setInterval> | undefined;
      runDbSimulation().then((id) => {
        if (id) activeInterval = id;
      });

      return () => {
        if (activeInterval) clearInterval(activeInterval);
      };
    }

    // Initial fetch of active vehicles and their latest logs
    const fetchInitialData = async () => {
      try {
        const { data: vehicleData, error: vError } = await supabase
          .from("vehicles")
          .select("*");

        if (vError) throw vError;
        if (vehicleData) {
          const vehicleMap = vehicleData.reduce(
            (acc, v) => ({ ...acc, [v.id]: v }),
            {},
          );
          setVehicles(vehicleMap);
        }

        const { data: logData, error: lError } = await supabase
          .from("vehicle_logs")
          .select("*")
          .order("captured_at", { ascending: false })
          .limit(1000); // Increased limit as guard rails

        if (lError) throw lError;
        if (logData) {
          const latestLogs: Record<string, VehicleLog> = {};
          logData.forEach((log: VehicleLog) => {
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
    const channelId = Math.random().toString(36).slice(2);
    const channel = supabase
      .channel(`vehicle-tracking-${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vehicle_logs" },
        (payload) => {
          const newLog = payload.new as VehicleLog;
          const lat = Number(newLog.latitude);
          const lng = Number(newLog.longitude);
          if (!isNaN(lat) && !isNaN(lng)) {
            setLogs((prev) => ({
              ...prev,
              [newLog.vehicle_id]: newLog,
            }));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "vehicles" },
        (payload) => {
          const updatedVehicle = payload.new as Vehicle;
          setVehicles((prev) => ({
            ...prev,
            [updatedVehicle.id]: updatedVehicle,
          }));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch((err) => {
        console.warn("Realtime channel cleanup warning:", err);
      });
    };
  }, []);

  return { vehicles, logs };
}
