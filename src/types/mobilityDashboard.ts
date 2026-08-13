export interface DashboardStatistics {
  totalVehicles: number;
  operational: number;
  underRepair: number;
  inactive: number;

  dueSoon: number;
  overdue: number;

  pendingInspection: number;
}

export interface MobilityStatusData {
  name: string;
  value: number;
}

export interface MaintenanceStatusData {
  name: string;
  value: number;
}

export interface MaintenanceTrend {
  month: string;
  completed: number;
}

export interface UpcomingMaintenance {
  id: string;
  plate_number: string;
  vehicle: string;
  maintenance_type: string;
  due_date: string | null;
  due_odometer: number | null;
  current_odometer: number;
  remaining_km: number;
  remaining_days: number;
  status: "GOOD" | "DUE_SOON" | "OVERDUE";
}
