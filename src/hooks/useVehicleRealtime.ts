import { useEffect, useState } from 'react';
import { supabase, Vehicle, VehicleLog } from '../lib/supabase';

export function useVehicleRealtime() {
  const [vehicles, setVehicles] = useState<Record<string, Vehicle>>({});
  const [logs, setLogs] = useState<Record<string, VehicleLog>>({});

  useEffect(() => {
    // Initial fetch of active vehicles and their latest logs
    const fetchInitialData = async () => {
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('*');
      
      if (vehicleData) {
        const vehicleMap = vehicleData.reduce((acc, v) => ({ ...acc, [v.id]: v }), {});
        setVehicles(vehicleMap);
      }

      // Fetch latest log for each vehicle
      const { data: logData } = await supabase
        .from('vehicle_logs')
        .select('*')
        .order('captured_at', { ascending: false });

      if (logData) {
        const latestLogs: Record<string, VehicleLog> = {};
        logData.forEach(log => {
          if (!latestLogs[log.vehicle_id]) {
            latestLogs[log.vehicle_id] = log;
          }
        });
        setLogs(latestLogs);
      }
    };

    fetchInitialData();

    // Subscribe to real-time updates for vehicle logs
    const channel = supabase
      .channel('vehicle-tracking')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'vehicle_logs' },
        (payload) => {
          const newLog = payload.new as VehicleLog;
          setLogs(prev => ({
            ...prev,
            [newLog.vehicle_id]: newLog
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'vehicles' },
        (payload) => {
          const updatedVehicle = payload.new as Vehicle;
          setVehicles(prev => ({
            ...prev,
            [updatedVehicle.id]: updatedVehicle
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { vehicles, logs };
}
