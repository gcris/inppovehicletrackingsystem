import { useState } from "react";
import { Bell, AlertTriangle, Clock, ChevronRight } from "lucide-react";
import { PMSNotification } from "../../hooks/useVehicleRealtime";

interface SidebarNotificationsProps {
  overdueCount: number;
  dueSoonCount: number;
  pmsNotifications: PMSNotification[];
  onViewPms?: (notification?: PMSNotification) => void;
}

export default function SidebarNotifications({
  overdueCount,
  dueSoonCount,
  pmsNotifications,
  onViewPms,
}: SidebarNotificationsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const totalNotifications = overdueCount + dueSoonCount;

  return (
    <div className="relative z-[100]">
      {/* =========================================
          NOTIFICATION BUTTON
      ========================================= */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative flex items-center justify-center rounded-xl border p-2.5 transition ${
          isOpen
            ? "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-900/20"
            : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700/50"
        }`}
      >
        <Bell
          size={24}
          className={
            isOpen
              ? "text-blue-600 dark:text-blue-400"
              : "text-slate-600 dark:text-slate-300"
          }
        />

        {/* Notification Badge */}
        {totalNotifications > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 font-bold leading-none text-white shadow-sm">
            {totalNotifications > 99 ? "99+" : totalNotifications}
          </span>
        )}
      </button>

      {/* =========================================
          NOTIFICATION POPUP
      ========================================= */}
      {isOpen && (
        <div
          className="
            absolute
            right-0
            top-full
            z-[9999]
            mt-2
            w-80
            overflow-hidden
            rounded-xl
            border
            border-slate-200
            bg-white
            shadow-2xl
            dark:border-slate-700
            dark:bg-slate-800
          "
        >
          {/* =====================================
              HEADER
          ===================================== */}
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Notifications
              </span>
            </div>
          </div>

          {/* =====================================
              NO NOTIFICATIONS
          ===================================== */}
          {totalNotifications === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell size={26} className="mx-auto mb-2 text-slate-400" />

              <p className="text-slate-500 dark:text-slate-400">
                No new notifications
              </p>
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
              {pmsNotifications.map((item) => (
                <button
                  key={`${item.vehicle_id}-${item.maintenance_type_id}`}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onViewPms?.(item);
                  }}
                  className="group w-full px-3 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  {/* Vehicle Header */}
                  <div className="flex items-start gap-3">
                    {/* Status Icon */}
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        item.status === "OVERDUE"
                          ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}
                    >
                      {item.status === "OVERDUE" ? (
                        <AlertTriangle size={18} />
                      ) : (
                        <Clock size={18} />
                      )}
                    </div>

                    {/* Vehicle Information */}
                    <div className="min-w-0 flex-1">
                      {/* Plate Number */}
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-slate-800 dark:text-white">
                          {item.plate_number}
                        </p>

                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold ${
                            item.status === "OVERDUE"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          }`}
                        >
                          {item.status.replace("_", " ")}
                        </span>
                      </div>

                      {/* Unit/Station */}
                      <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                        {item.unit_name}
                      </p>

                      {/* PMS Type */}
                      <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-900/60">
                        <p className="font-semibold text-slate-700 dark:text-slate-200">
                          {item.maintenance_type_name}
                        </p>
                      </div>

                      {/* Remaining */}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.days_remaining != null && (
                          <span className="text-slate-500 dark:text-slate-400">
                            📅{" "}
                            {item.days_remaining <= 0
                              ? `${Math.abs(item.days_remaining)} day(s) overdue`
                              : `${item.days_remaining} day(s) remaining`}
                          </span>
                        )}

                        {item.km_remaining != null && (
                          <span className="text-slate-500 dark:text-slate-400">
                            🚗{" "}
                            {item.km_remaining <= 0
                              ? `${Math.abs(item.km_remaining).toLocaleString()} km overdue`
                              : `${item.km_remaining.toLocaleString()} km remaining`}
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight
                      size={15}
                      className="mt-1 shrink-0 text-slate-400 transition group-hover:translate-x-0.5"
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
