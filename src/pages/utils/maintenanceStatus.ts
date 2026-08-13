import { MaintenanceHistory } from "../../lib/supabase";

export type MaintenanceStatus = "GOOD" | "DUE_SOON" | "OVERDUE";

export function getMaintenanceStatus(
  currentOdometer: number,
  nextServiceOdometer: number | null,
  nextServiceDate: string | null,
): MaintenanceStatus {
  const today = new Date();

  const dueDate = nextServiceDate ? new Date(nextServiceDate) : null;

  const daysRemaining = dueDate
    ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const kmRemaining = nextServiceOdometer
    ? nextServiceOdometer - currentOdometer
    : null;

  if (daysRemaining !== null && daysRemaining <= 0) {
    return "OVERDUE";
  }

  if (kmRemaining !== null && kmRemaining <= 0) {
    return "OVERDUE";
  }

  if (
    (daysRemaining !== null && daysRemaining <= 30) ||
    (kmRemaining !== null && kmRemaining <= 500)
  ) {
    return "DUE_SOON";
  }

  return "GOOD";
}

export const getMaintenanceReminders = (
  histories: MaintenanceHistory[],
  currentOdometer: number,
) => {
  const today = new Date();

  return histories.map((history) => {
    const daysRemaining = history.next_service_date != null
      ? Math.ceil(
        (new Date(history.next_service_date).getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24),
      )
      : null;

    const kmRemaining = history.next_service_odometer != null
      ? history.next_service_odometer - currentOdometer
      : null;

    return {
      maintenance_types: history.items
        .map((item) => item.maintenance_type?.name)
        .filter(Boolean),

      maintenance_type_name: history.items
        .map((item) => item.maintenance_type?.name)
        .filter(Boolean)
        .join(", "),

      next_service_date: history.next_service_date,
      next_service_odometer: history.next_service_odometer,

      days_remaining: daysRemaining,
      km_remaining: kmRemaining,

      status: getMaintenanceStatus(
        currentOdometer,
        history.next_service_odometer,
        history.next_service_date,
      ),
    };
  });
};

export function getMaintenanceSummary(reminders: any[]) {
  const summary = {
    dueSoon: 0,
    overdue: 0,
    good: 0,
  };

  reminders.forEach((item) => {
    if (item.status === "DUE_SOON") {
      summary.dueSoon++;
    } else if (item.status === "OVERDUE") {
      summary.overdue++;
    } else {
      summary.good++;
    }
  });

  return summary;
}

export function getLatestMaintenanceByType(
  histories: MaintenanceHistory[],
): MaintenanceHistory[] {
  const grouped = new Map<string, MaintenanceHistory>();

  histories.forEach((history) => {
    history.items?.forEach((item) => {
      const existing = grouped.get(item.maintenance_type_id);

      if (!existing) {
        grouped.set(item.maintenance_type_id, history);
        return;
      }

      const existingDate = existing.next_service_date
        ? new Date(existing.next_service_date).getTime()
        : 0;

      const currentDate = history.next_service_date
        ? new Date(history.next_service_date).getTime()
        : 0;

      if (currentDate > existingDate) {
        grouped.set(item.maintenance_type_id, history);
      }
    });
  });

  return [...grouped.values()];
}
