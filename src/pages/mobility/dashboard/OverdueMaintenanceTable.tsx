type OverdueItem = {
  plate_number: string;
  description: string | null;
  maintenance: string;
  dueDate: string | null;
  dueOdometer: number | null;
  kmRemaining: number | null;
  daysRemaining: number | null;
};

type Props = {
  data: OverdueItem[];
};

export default function OverdueMaintenanceTable({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center text-slate-500">
        <h3 className="text-lg font-semibold">No Overdue Maintenance</h3>

        <p className="mt-2 text-sm">
          Excellent! All maintenance schedules are up to date.
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
              <th className="px-5 py-3 text-left">Vehicle</th>
              <th className="px-5 py-3 text-left">Maintenance</th>
              <th className="px-5 py-3 text-left">Due Date</th>
              <th className="px-5 py-3 text-left">Due Odometer</th>
              <th className="px-5 py-3 text-left">Exceeded By</th>
              <th className="px-5 py-3 text-center">Status</th>
            </tr>
          </thead>

          <tbody>
            {data.map((item, index) => (
              <tr
                key={`${item.plate_number}-${index}`}
                className="border-t border-slate-200 hover:bg-red-50 dark:border-slate-800 dark:hover:bg-red-950/10"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-semibold">{item.plate_number}</div>

                      <div className="text-sm text-slate-500">
                        {item.description}
                      </div>
                    </div>
                  </div>
                </td>

                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    {item.maintenance}
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

                <td className="px-5 py-4">
                  <div className="space-y-1 text-sm">
                    {item.kmRemaining !== null && (
                      <div className="flex items-center gap-2 text-red-600">
                        {Math.abs(item.kmRemaining).toLocaleString()} km overdue
                      </div>
                    )}

                    {item.daysRemaining !== null && (
                      <div className="flex items-center gap-2 text-red-600">
                        {Math.abs(item.daysRemaining)} day(s) overdue
                      </div>
                    )}
                  </div>
                </td>

                <td className="px-5 py-4 text-center">
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    OVERDUE
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t bg-red-50 px-5 py-3 dark:border-slate-800 dark:bg-red-950/10">
        <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
          Immediate maintenance is required for the vehicles listed above.
        </div>
      </div>
    </div>
  );
}
