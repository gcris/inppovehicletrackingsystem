import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "";

export const isMock =
  supabaseUrl === "" ||
  supabaseUrl === "your-project-url" ||
  supabaseUrl.includes("your-project-url");

const customFetch = async (url: RequestInfo | URL, options?: RequestInit) => {
  const urlString = url.toString();
  if (urlString.includes("mock.supabase.co")) {
    // Mock response to prevent "Failed to fetch"
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return fetch(url, options);
};

export const supabase = createClient(
  isMock ? "https://mock.supabase.co" : supabaseUrl,
  isMock ? "mock-key" : supabaseAnonKey,
  {
    global: {
      fetch: customFetch,
    },
  },
);

export type Vehicle = {
  id: string;
  plate_number: string;
  vehicle_type: string; // e.g., 'Mobile Patrol', 'TMRU', 'Bike Patrol', 'Other'
  personnel_id: string | null;
  unit_id: string;
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

export type Unit = {
  id: string;
  unit_name: string;
};

export type Personnel = {
  id: string;
  badge_number: string | null;
  rank: string;
  fullname: string;
  unit_id: string;
  is_approved: boolean;
  role: "user" | "admin";
  email: string | null;
  phone_number: string | null;
  viber_number: string | null;
  designation: string | null;
  duty_status: string;
  remarks: string | null;
};

export type PatrolSchedule = {
  id: string;
  date: string;
  time_from: string;
  time_to: string;
  sector: string;
  unit_id: string;
  patrol_type: string; // 'Mobile' or 'Foot'
  unit?: Unit;
  // Note: personnel_id is removed, we now have a junction table
  schedule_assignments?: {
    id: string;
    schedule_id: string;
    personnel_id: string;
    personnel?: Personnel;
  }[];
};

export type PersonnelLog = {
  id: string;
  personnel_id: string;
  schedule_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  captured_at: string;
};

export type DutyShift = {
  id: string;
  shift_name: string;
  time_start: string;
  time_end: string;
  is_overnight: boolean;
  created_at: string;
};

export type ShiftAssignment = {
  id: string;
  personnel_id: string;
  shift_id: string;
  duty_date: string;
  personnel?: Personnel;
  duty_shift?: DutyShift;
  created_at: string;
};
