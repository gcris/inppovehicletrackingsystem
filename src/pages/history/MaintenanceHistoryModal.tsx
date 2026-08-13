import { X, AlertTriangle, Clock } from "lucide-react";
import { MaintenanceStatus } from "../utils/maintenanceStatus";

interface MaintenanceReminder {
  id: string;
  maintenance_type_id: string;
  maintenance_type_name: string;
  changed_at: string;
  next_service_date: string | null;
  next_service_odometer: number | null;
  status: MaintenanceStatus;
}

interface Props {
  open: boolean;
  onClose: () => void;
  vehicle: any;
}

function getLatestMaintenanceByType(
  histories: MaintenanceReminder[],
): MaintenanceReminder[] {
  const grouped = new Map<string, MaintenanceReminder>();

  histories.forEach((history) => {
    const existing = grouped.get(history.maintenance_type_id);

    if (
      !existing ||
      new Date(history.changed_at).getTime() >
        new Date(existing.changed_at).getTime()
    ) {
      grouped.set(history.maintenance_type_id, history);
    }
  });

  return Array.from(grouped.values());
}

function maintenanceList(maintenance_type_name: string) {
  const items = maintenance_type_name.split(", ");

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <span
            key={index}
            className="
              inline-block
              rounded-full
              bg-blue-100
              px-3
              py-1
              text-sm
              font-semibold
              text-blue-700
              dark:bg-blue-900/40
              dark:text-blue-300
            "
          >
            {index + 1}. {item}
          </span>
        ))}
      </div>
    </>
  );
}

export default function MaintenanceHistoryModal({
  open,
  onClose,
  vehicle,
}: Props) {
  if (!open || !vehicle) return null;

  const priority: Record<MaintenanceStatus, number> = {
    OVERDUE: 0,
    DUE_SOON: 1,
    GOOD: 2,
  };

  const reminders = getLatestMaintenanceByType(
    vehicle.maintenance_reminders ?? [],
  ).sort((a, b) => priority[a.status] - priority[b.status]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-6">
      <div className="w-full max-w-3xl max-h-[95vh] overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col p-4">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">PMS Reminder</h2>
            <p className="text-base text-slate-700 dark:text-slate-300">
              Plate Number: {vehicle.plate_number}
            </p>
          </div>

          <button onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="overflow-y-auto px-8 py-6">
          {reminders.map((item: any) => (
            <div
              key={`${item.maintenance_type_id}-${item.changed_at}`}
              className="rounded-xl border p-4 border-slate-200 dark:border-slate-800"
            >
              <div className="flex justify-between">
                <div className="font-semibold">
                  {maintenanceList(item.maintenance_type_name)}
                </div>

                {item.status === "OVERDUE" ? (
                  <AlertTriangle className="text-red-600" />
                ) : item.status === "DUE_SOON" ? (
                  <Clock className="text-yellow-600" />
                ) : (
                  <Clock className="text-green-600" />
                )}
              </div>

              <div className="mx-3 mt-2 text-base text-slate-700 dark:text-slate-300">
                <p>Due Date: {item.next_service_date ?? "-"}</p>

                <p>
                  Due Odometer Reading:{" "}
                  {item.next_service_odometer != null
                    ? `${item.next_service_odometer.toLocaleString()} km`
                    : "-"}
                </p>

                <p>Remaining day/s: {item.days_remaining}</p>

                <p>
                  Remaining km:{" "}
                  {item.km_remaining != null
                    ? `${item.km_remaining.toLocaleString()} km`
                    : "-"}
                </p>

                <p>
                  Status:{" "}
                  <span
                    className={`font-bold 
                      ${
                        item.status === "GOOD"
                          ? "text-green-600"
                          : item.status === "OVERDUE"
                            ? "text-red-600"
                            : "text-yellow-600"
                      }
                    `}
                  >
                    {item.status?.replace("_", " ")}
                  </span>
                </p>
              </div>
            </div>
          ))}

          {reminders.length === 0 && (
            <div className="py-10 text-center text-slate-700 dark:text-slate-300">
              No Periodic Maintenance Service reminder.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
