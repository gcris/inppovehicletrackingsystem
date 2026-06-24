import { useEffect, useState } from "react";
import { supabase, Personnel, PersonnelLog } from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";

export function usePersonnelRealtime() {
  const [personnel, setPersonnel] = useState<Record<string, Personnel>>({});
  const [personnelLogs, setPersonnelLogs] = useState<
    Record<string, PersonnelLog>
  >({});
  const { unitId, isAdmin } = useAuth();

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch personnel first to get the personnel ids we care about
        let personnelQuery = supabase.from("personnel").select("*");
        if (!isAdmin && unitId) {
          personnelQuery = personnelQuery.eq("unit_id", unitId);
        }
        const { data: personnelData, error: pError } = await personnelQuery;
        if (pError) throw pError;
        // Set personnel state
        if (personnelData) {
          const personnelMap = personnelData.reduce(
            (acc, p) => ({ ...acc, [p.id]: p }),
            {},
          );
          setPersonnel(personnelMap);
        }

        // Get personnel ids for filtering logs
        const personnelIds = personnelData?.map((p) => p.id) || [];

        // Fetch personnel logs
        let logsQuery = supabase
          .from("personnel_logs")
          .select("*")
          .order("captured_at", { ascending: false });
        // Note: Removed limit to avoid missing latest logs for personnel beyond the limit.
        // This may fetch many logs if there are many personnel and frequent logging.
        // Consider implementing pagination or a more efficient query if performance becomes an issue.
        if (!isAdmin && unitId) {
          if (personnelIds.length === 0) {
            // No personnel in unit, so no logs
            // Set logs to empty object and return early
            setPersonnelLogs({});
            return;
          }
        }

        const { data: logData, error: lError } = await logsQuery;
        if (lError) throw lError;

        // Process logs to get the latest log per personnel
        const latestLogs: Record<string, PersonnelLog> = {};
        console.log("logData: ", logData);
        if (logData) {
          logData.forEach((log: PersonnelLog) => {
            const lat = Number(log.latitude);
            const lng = Number(log.longitude);
            // Skip if coordinates are invalid
            if (isNaN(lat) || isNaN(lng)) {
              return;
            }
            // Update if no existing log or if new log is more recent
            // const existingLog = latestLogs[log.personnel_id];
            if (!latestLogs[log.personnel_id]) {
              latestLogs[log.personnel_id] = log;
            }
          });
        }

        console.log("latestLogs: ", latestLogs);
        setPersonnelLogs(latestLogs);
      } catch (err) {
        console.error("Error fetching initial personnel data:", err);
      }
    };

    fetchInitialData();

    // Subscribe to real-time updates for personnel
    const personnelChannel = supabase
      .channel(`personnel-changes`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "personnel" },
        (payload) => {
          try {
            const newPersonnel = payload.new as Personnel;
            if (!isAdmin && unitId) {
              if (newPersonnel.unit_id === unitId) {
                setPersonnel((prev) => ({
                  ...prev,
                  [newPersonnel.id]: newPersonnel,
                }));
              }
            } else {
              setPersonnel((prev) => ({
                ...prev,
                [newPersonnel.id]: newPersonnel,
              }));
            }
          } catch (err) {
            console.error("Error in personnel INSERT handler:", err);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "personnel" },
        (payload) => {
          try {
            const updatedPersonnel = payload.new as Personnel;
            if (!isAdmin && unitId) {
              if (updatedPersonnel.unit_id === unitId) {
                setPersonnel((prev) => ({
                  ...prev,
                  [updatedPersonnel.id]: updatedPersonnel,
                }));
              } else {
                // Remove if no longer in unit
                setPersonnel((prev) => {
                  const { [updatedPersonnel.id]: removed, ...rest } = prev;
                  return rest;
                });
              }
            } else {
              setPersonnel((prev) => ({
                ...prev,
                [updatedPersonnel.id]: updatedPersonnel,
              }));
            }
          } catch (err) {
            console.error("Error in personnel UPDATE handler:", err);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "personnel" },
        (payload) => {
          try {
            const deletedPersonnel = payload.old as Personnel;
            setPersonnel((prev) => {
              const { [deletedPersonnel.id]: removed, ...rest } = prev;
              return rest;
            });
          } catch (err) {
            console.error("Error in personnel DELETE handler:", err);
          }
        },
      )
      .subscribe();

    // Subscribe to real-time updates for personnel logs
    const logsChannel = supabase
      .channel(`personnel-logs-changes`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "personnel_logs" },
        (payload) => {
          try {
            const newLog = payload.new as PersonnelLog;
            const lat = Number(newLog.latitude);
            const lng = Number(newLog.longitude);
            // Skip if coordinates are invalid
            if (isNaN(lat) || isNaN(lng)) {
              return;
            }
            if (!isAdmin && unitId) {
              // Check if the personnel belongs to the user's unit using the personnel state
              const person = personnel[newLog.personnel_id];
              if (person && person.unit_id === unitId) {
                // Update if no existing log or if new log is more recent
                const existingLog = personnelLogs[newLog.personnel_id];
                if (
                  !existingLog ||
                  newLog.captured_at > existingLog.captured_at
                ) {
                  setPersonnelLogs((prev) => ({
                    ...prev,
                    [newLog.personnel_id]: newLog,
                  }));
                }
              }
              // If personnel is not in state, we assume it's not in our unit (or we haven't received it yet).
              // We rely on the personnel subscription to eventually bring the personnel into state.
            } else {
              // Admin sees all logs
              // Update if no existing log or if new log is more recent
              const existingLog = personnelLogs[newLog.personnel_id];
              if (
                !existingLog ||
                newLog.captured_at > existingLog.captured_at
              ) {
                setPersonnelLogs((prev) => ({
                  ...prev,
                  [newLog.personnel_id]: newLog,
                }));
              }
            }
          } catch (err) {
            console.error("Error in personnel_logs INSERT handler:", err);
          }
        },
      )
      // Note: We are not handling UPDATE or DELETE for personnel_logs as the table is assumed to be append-only.
      // If updates or deletes are possible, we should add handlers for them.
      .subscribe();

    // Cleanup subscriptions
    return () => {
      supabase.removeChannel(personnelChannel);
      supabase.removeChannel(logsChannel);
    };
  }, [isAdmin, unitId]); // Re-run effect if isAdmin or unitId changes

  return { personnel, personnelLogs };
}
