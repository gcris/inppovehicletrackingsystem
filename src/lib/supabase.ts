import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Vehicle = {
  id: string;
  plate_number: string;
  personnel_id: string | null;
  unit_id: string;
  load_status: "Normal" | "Expired";
  last_load_update: string;
  last_log?: VehicleLog;
};

export type VehicleLog = {
  id: string;
  vehicle_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  network_signal: number;
  captured_at: string;
};
