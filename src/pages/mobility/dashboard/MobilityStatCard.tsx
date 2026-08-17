import { Link } from "react-router-dom";
import {
  Car,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  ClipboardCheck,
  FileCheck,
} from "lucide-react";

type Props = {
  title: string;
  value: number;
  bg_color: string;
  border_color: string;
  expiring_soon?: number | 0;
  expired?: number | 0;
};

export default function MobilityStatCard({
  title,
  value,
  bg_color,
  border_color,
  expiring_soon,
  expired,
}: Props) {
  const query = title.includes("Total") ? "" : title;
  const colspan = title.includes("Total") ? "row-span-2" : "";
  return (
    <Link
      to={`/mobility-assets?query=${encodeURIComponent(query)}`}
      className={`
        group relative block overflow-hidden rounded-2xl
        border ${border_color}
        ${bg_color}
        shadow-sm
        transition-all duration-300
        hover:-translate-y-1
        hover:shadow-lg
        ${colspan}
      `}
    >
      {/* Decorative top gradient */}
      <div
        className="
          absolute inset-x-0 top-0 h-1
          bg-gradient-to-r
          from-blue-500
          via-indigo-500
          to-purple-500
          transition-all duration-300
          group-hover:h-1.5
        "
      />

      {/* Decorative circle */}
      {/* <div
        className="
          absolute -right-8 -top-8
          h-24 w-24 rounded-full
          dark:bg-white/10
          bg-slate-300/10
          transition-transform duration-500
          group-hover:scale-150
        "
      /> */}

      <div
        className={
          title.includes("Total")
            ? "relative flex h-full flex-col items-center justify-center p-5"
            : "relative p-5"
        }
      >
        {/* Header */}
        <div className="w-full text-center">
          <div className="min-w-0">
            <p className="mb-1 font-bold leading-6 text-slate-700 dark:text-slate-200">
              {title}
            </p>
          </div>
        </div>

        {/* Number */}
        <div
          className={
            title.includes("Total")
              ? "flex items-center justify-center"
              : "flex flex-1 items-center justify-center"
          }
        >
          <span className="text-5xl font-black text-slate-900 dark:text-white">
            {value.toLocaleString()}
          </span>
        </div>

        {/* Breakdown */}
        {((expiring_soon ?? 0) > 0 || (expired ?? 0) > 0) && (
          <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-300">
            {(expiring_soon ?? 0) > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300">
                  {title.includes("PMS") ? "Due" : "Expiring"} Soon
                </span>

                <span className="font-bold text-yellow-600 dark:text-yellow-400">
                  {expiring_soon}
                </span>
              </div>
            )}
            {(expired ?? 0) > 0 && (
              <div className="mt-1 flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300">
                  {title.includes("PMS") ? "Overdue" : "Expired"}
                </span>

                <span className="font-bold text-red-600 dark:text-red-400">
                  {expired}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Hover action */}
        {/* <div
          className="
            flex items-center justify-between
            border-t border-slate-100
            pt-3
            opacity-0
            transition-all duration-300
            group-hover:opacity-100
            dark:border-slate-800
          "
        >
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            View details
          </span>

          <span
            className="
              font-bold text-blue-600
              transition-transform duration-300
              group-hover:translate-x-1
              dark:text-blue-400
            "
          >
            →
          </span>
        </div> */}
      </div>
    </Link>
  );
}
