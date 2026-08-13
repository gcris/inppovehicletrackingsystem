import { useEffect, useState } from "react";
import { supabase, Personnel, PatrolLog } from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";

export function usePersonnelRealtime() {
  const [personnel, setPersonnel] = useState<Record<string, Personnel>>({});
  const { unitId, isAdmin } = useAuth();

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch personnel first to get the personnel ids we care about
        let personnelQuery = supabase
          .from("personnel")
          .select("*, rank(*), unit(*)");
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
      } catch (err) {
        console.error("Error fetching initial personnel data:", err);
      }
    };

    fetchInitialData();

    // Subscribe to real-time updates for personnel
    // const personnelChannel = supabase
    //   .channel(`personnel-changes`)
    //   .on(
    //     "postgres_changes",
    //     { event: "INSERT", schema: "public", table: "personnel" },
    //     (payload) => {
    //       try {
    //         const newPersonnel = payload.new as Personnel;
    //         if (!isAdmin && unitId) {
    //           if (newPersonnel.unit_id === unitId) {
    //             setPersonnel((prev) => ({
    //               ...prev,
    //               [newPersonnel.id]: newPersonnel,
    //             }));
    //           }
    //         } else {
    //           setPersonnel((prev) => ({
    //             ...prev,
    //             [newPersonnel.id]: newPersonnel,
    //           }));
    //         }
    //       } catch (err) {
    //         console.error("Error in personnel INSERT handler:", err);
    //       }
    //     },
    //   )
    //   .on(
    //     "postgres_changes",
    //     { event: "UPDATE", schema: "public", table: "personnel" },
    //     (payload) => {
    //       try {
    //         const updatedPersonnel = payload.new as Personnel;
    //         if (!isAdmin && unitId) {
    //           if (updatedPersonnel.unit_id === unitId) {
    //             setPersonnel((prev) => ({
    //               ...prev,
    //               [updatedPersonnel.id]: updatedPersonnel,
    //             }));
    //           } else {
    //             // Remove if no longer in unit
    //             setPersonnel((prev) => {
    //               const { [updatedPersonnel.id]: removed, ...rest } = prev;
    //               return rest;
    //             });
    //           }
    //         } else {
    //           setPersonnel((prev) => ({
    //             ...prev,
    //             [updatedPersonnel.id]: updatedPersonnel,
    //           }));
    //         }
    //       } catch (err) {
    //         console.error("Error in personnel UPDATE handler:", err);
    //       }
    //     },
    //   )
    //   .on(
    //     "postgres_changes",
    //     { event: "DELETE", schema: "public", table: "personnel" },
    //     (payload) => {
    //       try {
    //         const deletedPersonnel = payload.old as Personnel;
    //         setPersonnel((prev) => {
    //           const { [deletedPersonnel.id]: removed, ...rest } = prev;
    //           return rest;
    //         });
    //       } catch (err) {
    //         console.error("Error in personnel DELETE handler:", err);
    //       }
    //     },
    //   )
    //   .subscribe();

    // // Subscribe to real-time updates for personnel logs
    // const logsChannel = supabase
    //   .channel(`personnel-logs-changes`)
    //   .on(
    //     "postgres_changes",
    //     { event: "INSERT", schema: "public", table: "patrol_logs" },
    //     (payload) => {
    //       try {
    //         const newLog = payload.new as PatrolLog;
    //         const lat = Number(newLog.latitude);
    //         const lng = Number(newLog.longitude);
    //         // Skip if coordinates are invalid
    //         if (isNaN(lat) || isNaN(lng)) {
    //           return;
    //         }
    //         if (!isAdmin && unitId) {
    //           // Check if the personnel belongs to the user's unit using the personnel state
    //           const person = personnel[newLog.personnel_id];
    //           if (person && person.unit_id === unitId) {
    //             // Update if no existing log or if new log is more recent
    //             const existingLog = personnelLogs[newLog.personnel_id];
    //             if (
    //               !existingLog ||
    //               newLog.captured_at > existingLog.captured_at
    //             ) {
    //               setPersonnelLogs((prev) => ({
    //                 ...prev,
    //                 [newLog.personnel_id]: newLog,
    //               }));
    //             }
    //           }
    //           // If personnel is not in state, we assume it's not in our unit (or we haven't received it yet).
    //           // We rely on the personnel subscription to eventually bring the personnel into state.
    //         } else {
    //           // Admin sees all logs
    //           // Update if no existing log or if new log is more recent
    //           const existingLog = personnelLogs[newLog.personnel_id];
    //           if (
    //             !existingLog ||
    //             newLog.captured_at > existingLog.captured_at
    //           ) {
    //             setPersonnelLogs((prev) => ({
    //               ...prev,
    //               [newLog.personnel_id]: newLog,
    //             }));
    //           }
    //         }
    //       } catch (err) {
    //         console.error("Error in patrol_logs INSERT handler:", err);
    //       }
    //     },
    //   )
    //   // Note: We are not handling UPDATE or DELETE for patrol_logs as the table is assumed to be append-only.
    //   // If updates or deletes are possible, we should add handlers for them.
    //   .subscribe();

    // // Cleanup subscriptions
    // return () => {
    //   supabase.removeChannel(personnelChannel);
    //   // supabase.removeChannel(logsChannel);
    // };
  }, [isAdmin, unitId]); // Re-run effect if isAdmin or unitId changes

  return { personnel };
}
