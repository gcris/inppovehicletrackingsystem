type MaintenanceItem = {
  plate_number: string;
  description: string | null;
  unit_name: string | null;
  maintenance: string;
  dueDate: string | null;
  dueOdometer: number | null;
  kmRemaining: number | null;
  daysRemaining: number | null;
  status: "GOOD" | "DUE_SOON" | "OVERDUE";
};

type Props = {
  data: MaintenanceItem[];
};

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

export default function UpcomingMaintenanceTable({ data }: Props) {
  const statusBadge = (status: MaintenanceItem["status"]) => {
    switch (status) {
      case "GOOD":
        return (
          <span className="rounded-full bg-green-100 px-3 py-1 font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Good
          </span>
        );

      case "DUE_SOON":
        return (
          <span className="rounded-full bg-yellow-100 px-3 py-1 font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            Due Soon
          </span>
        );

      case "OVERDUE":
        return (
          <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
            Overdue
          </span>
        );
    }
  };

  const remaining = (row: MaintenanceItem) => {
    const hasKm = row.kmRemaining !== null && row.kmRemaining !== undefined;
    const hasDays =
      row.daysRemaining !== null && row.daysRemaining !== undefined;

    if (!hasKm && !hasDays) {
      return "-";
    }

    return (
      <div className="space-y-1 text-slate-700 dark:text-slate-300">
        {hasKm && <span>{row.kmRemaining!.toLocaleString()} km</span>}
        {hasKm && hasDays && <span> or </span>}
        {hasDays && <span>{row.daysRemaining} day(s)</span>}
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center text-slate-500">
        <h3 className="text-lg font-semibold">
          No Upcoming Periodic Maintenance Service schedule
        </h3>

        <p className="mt-2">
          All vehicles are currently within Periodic Maintenance Service
          schedule.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="px-5 py-3 text-left font-semibold">Mobility</th>

              <th className="px-5 py-3 text-center font-semibold">
                Preventive Maintenance Services
              </th>

              <th className="px-5 py-3 text-left font-semibold">Due Date</th>

              <th className="px-5 py-3 text-left font-semibold">
                Due Odometer Reading
              </th>

              <th className="px-5 py-3 text-left font-semibold">
                Remaining Odometer Reading and Days
              </th>

              <th className="px-5 py-3 text-center font-semibold">Status</th>
            </tr>
          </thead>

          <tbody>
            {data.map((item, index) => (
              <tr
                key={`${item.plate_number}-${index}`}
                className="border-t border-slate-200 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-semibold">{item.plate_number}</div>

                      <div className="text-slate-500">{item.description}</div>
                      <div className="text-slate-500">{item.unit_name}</div>
                    </div>
                  </div>
                </td>

                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    {maintenanceList(item.maintenance)}
                  </div>
                </td>

                <td className="px-5 py-4">
                  {item.dueDate
                    ? new Date(item.dueDate).toLocaleDateString()
                    : "-"}
                </td>

                <td className="px-5 py-4">
                  {item.dueOdometer != null
                    ? `${item.dueOdometer.toLocaleString()} km`
                    : "-"}
                </td>

                <td className="px-5 py-4">{remaining(item)}</td>

                <td className="px-5 py-4 text-center">
                  {statusBadge(item.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.some((d) => d.status === "DUE_SOON") && (
        <div className="border-t bg-yellow-50 px-5 py-3 dark:border-slate-800 dark:bg-yellow-900/10">
          <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
            Vehicles listed above require preventive maintenance soon.
          </div>
        </div>
      )}
    </div>
  );
}
