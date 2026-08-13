import React, { memo, useCallback, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { MaintenanceHistory, supabase } from "../../lib/supabase";
import { Edit2, Image, Trash2 } from "lucide-react";

interface MaintenanceHistoryRowProps {
  index: number;
  history: MaintenanceHistory;
  onEdit: (history: MaintenanceHistory) => void;
  onDelete: (id: string) => void;
}

const MaintenanceHistoryRow = ({
  index,
  history,
  onEdit,
  onDelete,
}: MaintenanceHistoryRowProps) => {
  // ==========================
  // Memoized formatted dates
  // ==========================

  const changedAt = useMemo(
    () => format(parseISO(history.changed_at), "MMM dd, yyyy hh:mm a"),
    [history.changed_at],
  );

  const lastServiceDate = useMemo(() => {
    if (!history.last_service_date) return "-";

    return format(parseISO(history.last_service_date), "MMM dd, yyyy");
  }, [history.last_service_date]);

  const nextServiceDate = useMemo(() => {
    if (!history.next_service_date) return "-";

    return format(parseISO(history.next_service_date), "MMM dd, yyyy");
  }, [history.next_service_date]);

  const lastServiceOdometer = useMemo(
    () => history.last_service_odometer.toLocaleString(),
    [history.last_service_odometer],
  );

  const nextServiceOdometer = useMemo(() => {
    if (!history.next_service_odometer) return "-";

    return `${history.next_service_odometer.toLocaleString()} km`;
  }, [history.next_service_odometer]);

  // ==========================
  // Callbacks
  // ==========================

  const handleEdit = useCallback(() => {
    onEdit(history);
  }, [history, onEdit]);

  const handleDelete = useCallback(() => {
    onDelete(history.id);
  }, [history.id, onDelete]);

  return (
    <tr className="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
      <td className="px-5 py-4 whitespace-nowrap">{index + 1}</td>
      {/* Date */}
      <td className="px-5 py-4 whitespace-nowrap">{changedAt}</td>

      {/* Vehicle */}
      <td className="px-5 py-4">
        <div className="font-medium">
          {history.mobility_asset?.plate_number ?? "No Plate Number"}
        </div>

        <div className="text-black dark:text-slate-300">
          {history.mobility_asset?.vehicle_type}
        </div>

        <div className="text-black dark:text-slate-300">
          {history.mobility_asset?.unit?.unit_name}
        </div>
      </td>

      {/* Maintenance Types */}
      <td className="px-5 py-4">
        <div className="flex flex-col items-start gap-1">
          {history.items?.map((item, index) => (
            <p
              key={item.id}
              className="
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
              {index + 1}. {item.maintenance_type.name}
            </p>
          ))}
        </div>
      </td>

      {/* Last Service */}
      <td className="px-5 py-4">
        <p>{lastServiceDate}</p>

        <p>{lastServiceOdometer} km</p>
      </td>

      {/* Shop */}
      <td className="px-5 py-4">
        <p className="font-semibold">{history.service_center_name}</p>
        <p>{history.service_center}</p>
        <p>{history.service_center_location}</p>
      </td>

      {/* Next Service */}
      <td className="px-5 py-4">
        <p>{nextServiceDate}</p>

        <p>{nextServiceOdometer}</p>
      </td>

      {/* Personnel */}
      <td className="px-5 py-4">
        {history.personnel ? (
          <div>
            <div className="font-medium">
              {history.personnel.rank?.rank_name} {history.personnel.fullname}
            </div>

            <div className="text-slate-500">
              {history.personnel.designation}
            </div>
          </div>
        ) : (
          "-"
        )}
      </td>

      {/* Actions */}
      <td className="px-5 py-4">
        <div className="flex items-center justify-center gap-2">
          {/* Edit */}
          <div className="group relative inline-flex">
            <button
              onClick={handleEdit}
              className="rounded-lg border border-slate-300 p-2 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <Edit2 className="h-5 w-5 text-slate-700 dark:text-slate-300" />
            </button>

            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 flex-col items-center group-hover:flex">
              <div className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1 font-medium whitespace-nowrap text-slate-100 shadow-md dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900">
                Update Record
              </div>

              <div className="h-2 w-2 -mt-1 rotate-45 border-r border-b border-slate-800 bg-slate-900 dark:border-slate-200 dark:bg-slate-100" />
            </div>
          </div>

          {/* Delete */}
          <div className="group relative inline-flex">
            <button
              onClick={handleDelete}
              className="rounded-lg border border-red-300 p-2 text-red-600 transition-colors hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-5 w-5" />
            </button>

            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 flex-col items-center group-hover:flex">
              <div className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1 font-medium whitespace-nowrap text-slate-100 shadow-md dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900">
                Delete Record
              </div>

              <div className="h-2 w-2 -mt-1 rotate-45 border-r border-b border-slate-800 bg-slate-900 dark:border-slate-200 dark:bg-slate-100" />
            </div>
          </div>

          {/* View Proof */}
          {history.proof_photo_url ? (
            <div className="group relative inline-flex">
              <button
                onClick={async () => {
                  const { data, error } = await supabase.storage
                    .from("pms-proofs")
                    .createSignedUrl(history.proof_photo_url, 60);

                  if (error) {
                    console.error(error);
                    return;
                  }

                  window.open(data.signedUrl, "_blank");
                }}
                className="rounded-lg border border-blue-300 p-2 text-blue-600 transition-colors hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/20"
              >
                <Image className="h-5 w-5" />
              </button>

              <div className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 hidden flex-col items-end group-hover:flex">
                <div className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1 font-medium whitespace-nowrap text-slate-100 shadow-md dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900">
                  View Proof of PMS/Official Receipt
                </div>

                <div className="mr-3 h-2 w-2 -mt-1 rotate-45 border-r border-b border-slate-800 bg-slate-900 dark:border-slate-200 dark:bg-slate-100" />
              </div>
            </div>
          ) : (
            <span className="text-slate-400 dark:text-slate-600">-</span>
          )}
        </div>
      </td>
    </tr>
  );
};

export default React.memo(MaintenanceHistoryRow, (prev, next) => {
  return prev.history === next.history && prev.index === next.index;
});
