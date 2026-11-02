import { useEffect, useRef, useState } from "react";
import { MobilityAsset, PatrolLog, Personnel, supabase } from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";

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
  // LOAD INITIAL DATA
  // =====================================================

  useEffect(() => {
    let cancelled = false;

    const loadInitialData = async () => {
      try {
        // =====================================================
        // LOAD VEHICLES
        // =====================================================

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

        // =====================================================
        // CONVERT VEHICLES TO MAP
        // =====================================================

        const vehicleMap: Record<
          string,
          MobilityAsset
        > = {};

        vehicleData?.forEach((vehicle) => {
          vehicleMap[vehicle.id] = vehicle;
        });

        // =====================================================
        // LOAD LATEST LOGS FIRST
        // =====================================================

        const threeHoursAgo = new Date();
        threeHoursAgo.setHours(threeHoursAgo.getHours() - 3);

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
            threeHoursAgo.toISOString(),
          );

        if (logError) throw logError;

        // =====================================================
        // GET ONLY PERSONNEL IDS ACTUALLY USED BY LOGS
        // =====================================================

        const personnelIds = [
          ...new Set(
            (logData ?? [])
              .map((log) => log.personnel_id)
              .filter(
                (id): id is string => Boolean(id),
              ),
          ),
        ];

        // =====================================================
        // LOAD ONLY REQUIRED PERSONNEL
        // =====================================================

        const personnelMap: Record<
          string,
          Personnel
        > = {};

        if (personnelIds.length > 0) {
          const {
            data: personnelData,
            error: personnelError,
          } = await supabase
            .from("personnel")
            .select("*, rank(*), unit:unit!personnel_unit_id_fkey(*)")
            .in("id", personnelIds);

          if (personnelError) {
            throw personnelError;
          }

          personnelData?.forEach((member) => {
            personnelMap[member.id] = member;
          });
        }

        // =====================================================
        // BUILD LATEST LOG MAP
        // =====================================================

        const latestLogs: Record<
          string,
          PatrolLog
        > = {};

        logData?.forEach((log) => {
          const trackingKey = log.vehicle_id ??
            log.personnel_id;

          if (!trackingKey) return;

          // ------------------------------------------
          // Validate coordinates
          // ------------------------------------------

          const lat = Number(log.latitude);
          const lng = Number(log.longitude);

          if (
            Number.isNaN(lat) ||
            Number.isNaN(lng)
          ) {
            return;
          }

          // ------------------------------------------
          // Unit filtering
          // ------------------------------------------

          if (!isAdmin && unitId) {
            // Vehicle patrol
            if (log.vehicle_id) {
              const vehicle = vehicleMap[log.vehicle_id];

              if (
                !vehicle ||
                vehicle.unit_id !== unitId
              ) {
                return;
              }
            }

            // Foot/personnel patrol
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

          // ------------------------------------------
          // Keep only newest log
          // ------------------------------------------

          const existing = latestLogs[trackingKey];

          if (
            !existing ||
            new Date(log.captured_at) >
              new Date(existing.captured_at)
          ) {
            latestLogs[trackingKey] = log;
          }
        });

        // =====================================================
        // UPDATE STATE
        // =====================================================

        if (!cancelled) {
          setVehicles(vehicleMap);
          setPersonnel(personnelMap);
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
              const clone = {
                ...prev,
              };

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

          setVehicles((prev) => {
            const clone = {
              ...prev,
            };

            delete clone[vehicle.id];

            return clone;
          });
        },
      );

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
        async ({ new: inserted }) => {
          const log = inserted as PatrolLog;

          // ------------------------------------------
          // Validate coordinates
          // ------------------------------------------

          const lat = Number(log.latitude);
          const lng = Number(log.longitude);

          if (
            Number.isNaN(lat) ||
            Number.isNaN(lng)
          ) {
            return;
          }

          // ------------------------------------------
          // Vehicle OR Foot Patrolling
          // ------------------------------------------

          const trackingKey = log.vehicle_id ??
            log.personnel_id;

          if (!trackingKey) {
            return;
          }

          // ------------------------------------------
          // Unit filtering - VEHICLE
          // ------------------------------------------

          if (
            !isAdmin &&
            unitId &&
            log.vehicle_id
          ) {
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

          // ------------------------------------------
          // Personnel may not be loaded yet
          // ------------------------------------------

          if (
            log.personnel_id &&
            !personnelRef.current[
              log.personnel_id
            ]
          ) {
            const {
              data: officer,
              error,
            } = await supabase
              .from("personnel")
              .select("*, unit:unit!personnel_unit_id_fkey(*)")
              .eq(
                "id",
                log.personnel_id,
              )
              .maybeSingle();

            if (error) {
              console.error(
                "Failed to load patrol personnel:",
                error,
              );
              return;
            }

            if (officer) {
              if (
                !isAdmin &&
                unitId &&
                officer.unit_id !== unitId
              ) {
                return;
              }

              setPersonnel((prev) => ({
                ...prev,
                [officer.id]: officer,
              }));
            }
          }

          // ------------------------------------------
          // Unit filtering - PERSONNEL
          // ------------------------------------------

          if (
            !isAdmin &&
            unitId &&
            log.personnel_id
          ) {
            const officer = personnelRef.current[
              log.personnel_id
            ];

            // The newly fetched officer may not
            // have reached the ref yet, so allow
            // the state update above to handle it.
            if (
              officer &&
              officer.unit_id !== unitId
            ) {
              return;
            }
          }

          // ------------------------------------------
          // Update only if newer
          // ------------------------------------------

          setLogs((prev) => {
            const existing = prev[trackingKey];

            if (
              existing &&
              new Date(
                  existing.captured_at,
                ) >=
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
  };
}
