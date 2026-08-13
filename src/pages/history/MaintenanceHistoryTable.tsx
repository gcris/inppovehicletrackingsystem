import React, { memo } from "react";
import MaintenanceHistoryRow from "./MaintenanceHistoryRow";
import { MaintenanceHistory } from "../../lib/supabase";

interface Props {
  history: MaintenanceHistory[];
  onEdit: (history: MaintenanceHistory) => void;
  onDelete: (id: string) => void;
  currentPage: number;
  pageSize: number;
}

function MaintenanceHistoryTable({
  history,
  onEdit,
  onDelete,
  currentPage,
  pageSize,
}: Props) {
  return (
    <tbody>
      {history.map((item, index) => (
        <MaintenanceHistoryRow
          key={item.id}
          index={(currentPage - 1) * pageSize + index}
          history={item}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}

      {history.length === 0 && (
        <tr>
          <td colSpan={9} className="px-6 py-16 text-center text-slate-500">
            No PMS History found.
          </td>
        </tr>
      )}
    </tbody>
  );
}

export default memo(MaintenanceHistoryTable);
