import React, { memo } from "react";
import MobilityRow from "./MobilityRow";
import { MobilityAsset } from "../../lib/supabase";

interface MobilityTableProps {
  vehicles: MobilityAsset[];
  onEdit: (vehicle: MobilityAsset) => void;
  onDelete: (id: string) => void;
  onOpenMaintenance: (vehicle: MobilityAsset) => void;
  getStatusColor: (status: string) => string;
  isExpired: (date: string) => boolean;
  isExpiringSoon: (date: string) => boolean;
  currentPage: number;
  pageSize: number;
}

function MobilityTable({
  vehicles,
  onEdit,
  onDelete,
  onOpenMaintenance,
  getStatusColor,
  isExpired,
  isExpiringSoon,
  pageSize,
  currentPage,
}: MobilityTableProps) {
  return (
    <tbody>
      {vehicles.length === 0 ? (
        <tr>
          <td
            colSpan={11}
            className="px-6 py-16 text-center text-slate-500 dark:text-slate-400"
          >
            No mobility assets found.
          </td>
        </tr>
      ) : (
        vehicles.map((vehicle, index) => (
          <MobilityRow
            key={vehicle.id}
            index={(currentPage - 1) * pageSize + index}
            vehicle={vehicle}
            onEdit={onEdit}
            onDelete={onDelete}
            onOpenMaintenance={onOpenMaintenance}
            getStatusColor={getStatusColor}
            isExpired={isExpired}
            isExpiringSoon={isExpiringSoon}
          />
        ))
      )}
    </tbody>
  );
}

export default memo(MobilityTable, (prevProps, nextProps) => {
  return (
    prevProps.vehicles === nextProps.vehicles &&
    prevProps.onEdit === nextProps.onEdit &&
    prevProps.onDelete === nextProps.onDelete &&
    prevProps.onOpenMaintenance === nextProps.onOpenMaintenance
  );
});
