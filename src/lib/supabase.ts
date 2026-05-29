import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

const isMock = supabaseUrl === '' || supabaseUrl === 'your-project-url' || supabaseUrl.includes('your-project-url');

const customFetch = async (url: RequestInfo | URL, options?: RequestInit) => {
  const urlString = url.toString();
  if (urlString.includes('mock.supabase.co')) {
    // Mock response to prevent "Failed to fetch"
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return fetch(url, options);
};

export const supabase = createClient(
  isMock ? 'https://mock.supabase.co' : supabaseUrl,
  isMock ? 'mock-key' : supabaseAnonKey,
  {
    global: {
      fetch: customFetch
    }
  }
);

export type Vehicle = {
  id: string;
  plate_number: string;
  personnel_id: string | null;
  unit_id: string;
  load_status: 'Normal' | 'Expired' | 'Maintenance';
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
  role: 'user' | 'admin';
};

export type Schedule = {
  id: string;
  date: string;
  time_from: string;
  time_to: string;
  sector: string;
  unit_id: string;
  personnel_id: string;
  personnel?: Personnel;
  unit?: Unit;
};
