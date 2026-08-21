import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "";

export const isMock = supabaseUrl === "" ||
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

export type MobilityAsset = {
  id: string;
  plate_number: string;
  vehicle_type: string; // e.g., 'Mobile Patrol', 'TMRU', 'Bike Patrol', 'Other'
  unit_id: string;
  last_log?: PatrolLog;
  description: string | null;
  status: string | null;
  unit?: Unit; // Optional reference to unit

  // Base fields from mobility_assets table (aligned with database schema)
  current_odometer: number; // Current odometer reading in km (INTEGER NOT NULL DEFAULT 0)
  created_at: string | null; // Timestamp when record was created
  updated_at: string | null; // Timestamp when record was last updated

  // Vehicle Details & Identity
  year_model: string | null;
  or_number: string | null;
  cr_number: string | null;
  engine_number: string | null;
  chassis_number: string | null;

  // Source & Registration
  source: "Organic" | "Loaned" | "Donated" | null;
  date_of_last_registration: string | null; // Format: ISO date string 'YYYY-MM-DD'
  date_registration_expires: string | null; // Format: ISO date string 'YYYY-MM-DD'

  // Insurance
  insurance_provider: string | null;
  insurance_coverage_date: string | null; // Format: ISO date string 'YYYY-MM-DD'

  // Driver & Personnel
  driver_id: string | null; // References personnel (id)
  driver?: Personnel; // Optional related Personnel object
  maintenance_reminders: [];
  maintenance_summary: {
    dueSoon: string;
    overdue: string;
    good: string;
  };

  updated_by: string | null; // References personnel (id)
  updated_by_personnel?: Personnel | null; // Optional related Personnel object

  remarks: string | null; // Only when UNSER/ BER

  photos: MobilityPhoto[];
};

export type MobilityPhoto = {
  id: string;
  mobility_id: string;
  storage_path: string;
  photo_order: number;
};

// Maintenance history tracking
export type MaintenanceHistory = {
  id: string;
  mobility_asset_id: string;
  changed_at: string;
  changed_by: string; // References personnel
  personnel: Personnel | null;
  // Maintenance fields history (generic for any maintenance type)
  last_service_date: string | null; // Date of last service (ISO string)
  last_service_odometer: number; // Odometer at last service
  next_service_odometer: number | null; // Calculated: last_service_odometer + interval_km
  next_service_date: string | null; // Calculated: last_service_date + interval_months

  // Related data (optional, from joins)
  mobility_asset?: MobilityAsset;
  maintenance_type?: MaintenanceType;

  items: MaintenanceHistoryItem[];

  service_center: string;
  service_center_name: string;
  service_center_location: string;
  proof_photo_url: string;
};

export type MaintenanceHistoryItem = {
  id: string;
  maintenance_history_id: string;
  maintenance_type_id: string;
  created_at: string;

  maintenance_type: MaintenanceType;
};

export type MaintenanceType = {
  id: string;
  name: string;
  description: string | null;
  default_interval_km: number;
  default_interval_months: number;
};

export type PatrolLog = {
  id: string;
  vehicle_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  network_signal: number;
  captured_at: string;
  duty_type: string;
  status: string;
  personnel_id: string;
  description: string;
};

export type Unit = {
  id: string;
  unit_name: string;
  level: number;
  classification: number | null; // Added classification column
};

export type Rank = {
  id: string;
  rank_name: string;
  description: string | null;
  level: number;
};

export type Personnel = {
  id: string;
  badge_number: string | null;
  rank_id: string | null;
  rank?: Rank;
  fullname: string;
  unit_id: string;
  unit?: Unit;
  is_approved: boolean;
  role: "operation" | "admin" | "supply" | "admin_supply";
  email: string | null;
  phone_number: string | null;
  viber_number: string | null;
  designation: string | null;
  duty_status: string;
  remarks: string | null;
  photo_url: string | null;

  is_blocked: boolean;
  blocked_at: string | null;
  blocked_by: string | null;
  block_reason: string | null;
  mfa_enabled: boolean;
  photo_bucket: string | null;

  // PNP ID
  id_card_number: string;
  date_issued: string;
  expiration_date: string;

  drivers_license_no: string;
  drivers_license_expiration: string;
  drivers_license_type: string;
  drivers_license_restrictions: string[] | null;
  drivers_license_transmission: "MANUAL" | "AUTOMATIC" | "BOTH" | null;
  drivers_license_photo_path?: string | null;
};

export type PatrolSchedule = {
  id: string;
  date: string;
  time_from: string;
  time_to: string;
  sector: string;
  unit_id: string;
  mobility_id: string | null;
  patrol_type: string;
  description: string | null;
  unit?: Unit;
  mobility?: MobilityAsset;
  // Note: personnel_id is removed, we now have a junction table
  schedule_assignments?: {
    id: string;
    schedule_id: string;
    personnel_id: string;
    personnel?: Personnel;
  }[];
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

export type Team = {
  id: string;
  team_name: string;
  unit_id: string;
  description: string | null;
  unit?: Unit;
  member_count?: number;
};

export type TeamMember = {
  id: string;
  team_id: string;
  personnel_id: string;
  is_team_leader: boolean;
  personnel?: Personnel;
};

export type Calendar = {
  id: string;
  created_at: string;
  title: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  venue: string | null;
  file_link: string | null;
  category: string | null;
  distributions: string[] | null; // Changed from string | null to string[] | null for unit tagging
  user_id: string;
  unit_id: string; // Added for unit filtering as requested
  unit: Unit | null; // Optional reference to unit
};

// Added designation type
export type Designation = {
  id: string;
  unit_classification: number; // Note: keeping the typo as in the database
  name: string;
};

export interface VehicleInspectionCategory {
  id: string;
  name: string;
  description?: string | null;
  display_order: number;
  created_at?: string;
}

export interface VehicleInspectionItem {
  id: string;
  category_id: string;
  code: string;
  name: string;
  description?: string | null;
  display_order: number;
  is_required: boolean;
  is_active: boolean;
  created_at?: string;

  category?: VehicleInspectionCategory;
  unit_id: string;
}

export interface VehicleInspection {
  id: string;

  mobility_asset_id: string;
  mobility_asset?: MobilityAsset;

  unit_id: string;
  unit: Unit;

  inspected_at: string;

  inspected_by: string;
  supervisor_name: string;

  designated_driver_id?: string | null;
  designated_driver?: Personnel | null;

  alternate_driver_id?: string | null;
  alternate_driver?: Personnel | null;

  overall_status: "PASSED" | "FAILED" | "WITH_DEFECTS";

  remarks?: string | null;

  created_at?: string;
  updated_at?: string;

  results?: VehicleInspectionResult[];
}

export interface VehicleInspectionResult {
  id: string;

  inspection_id: string;

  inspection_item_id: string;
  inspection_item?: VehicleInspectionItem;

  status: "COMPLIED" | "UNCOMPLIED" | "NOT_APPLICABLE";

  remarks?: string | null;

  created_at?: string;
}
