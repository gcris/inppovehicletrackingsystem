import { useEffect, useState } from 'react';
import { supabase, Vehicle, VehicleLog } from '../lib/supabase';

export function useVehicleRealtime() {
  const [vehicles, setVehicles] = useState<Record<string, Vehicle>>({});
  const [logs, setLogs] = useState<Record<string, VehicleLog>>({});

  useEffect(() => {
    // Initial fetch of active vehicles and their latest logs
    const fetchInitialData = async () => {
      try {
        const { data: vehicleData, error: vError } = await supabase
          .from('vehicles')
          .select('*');
        
        if (vError) throw vError;
        if (vehicleData) {
          const vehicleMap = vehicleData.reduce((acc, v) => ({ ...acc, [v.id]: v }), {});
          setVehicles(vehicleMap);
        }

        const { data: logData, error: lError } = await supabase
          .from('vehicle_logs')
          .select('*')
          .order('captured_at', { ascending: false });

        if (lError) throw lError;
        if (logData) {
          const latestLogs: Record<string, VehicleLog> = {};
          logData.forEach(log => {
            if (!latestLogs[log.vehicle_id]) {
              latestLogs[log.vehicle_id] = log;
            }
          });
          setLogs(latestLogs);
        }
      } catch (err) {
        console.error('Error fetching vehicle data:', err);
      }
    };

    fetchInitialData();

    // Subscribe to real-time updates for vehicle logs with a unique channel name to avoid collisions
    const channelId = Math.random().toString(36).slice(2);
    const channel = supabase
      .channel(`vehicle-tracking-${channelId}`)
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
