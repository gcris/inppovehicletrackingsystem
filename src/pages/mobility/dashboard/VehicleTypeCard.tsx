import { Link } from "react-router-dom";

interface VehicleTypeCardProps {
  title: string;
  total: number;
  serviceable: number;
  unserviceable: number;
  ber: number;
  organic: number;
  donated: number;
  loaned: number;
}

export default function VehicleTypeCard({
  title,
  total,
  serviceable,
  unserviceable,
  ber,
  organic,
  donated,
  loaned,
}: VehicleTypeCardProps) {
  return (
    <Link
      to={`/mobility-assets?query=${encodeURIComponent(title)}`}
      className="
        group relative block overflow-hidden
        rounded-2xl
        border border-slate-200
        bg-white
        shadow-sm
        transition-all duration-300
        hover:-translate-y-1
        hover:shadow-xl
        dark:border-slate-700
        dark:bg-slate-900
      "
    >
      {/* Decorative color bar */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

      <div className="px-2 py-2">
        {/* Vehicle Type */}
        <p className="min-h-[48px] font-bold leading-6 text-slate-700 dark:text-slate-200">
          {title}
        </p>
        {/* Big Total */}
        <div className="flex flex-1 items-center justify-center mb-3">
          <span className="text-5xl font-black text-slate-900 dark:text-white">
            {total.toLocaleString()}
          </span>
        </div>
        {/* Status Breakdown */}
        <div className="grid grid-cols-3 gap-2">
          {/* Serviceable */}
          <div
            className="
                rounded-xl
                border border-emerald-200
                bg-emerald-50
                px-1 py-1.5
                text-center
                dark:border-emerald-800
                dark:bg-emerald-950/40
            "
          >
            <p className="text-xs font-semibold tracking-wide text-emerald-600 dark:text-emerald-400">
              SER
            </p>

            <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">
              {serviceable}
            </p>
          </div>

          {/* Unserviceable */}
          <div
            className="
                rounded-xl
                border border-amber-200
                bg-amber-50
                px-1 py-1.5
                text-center
                dark:border-amber-800
                dark:bg-amber-950/40
            "
          >
            <p className="text-xs font-semibold tracking-wide text-amber-600 dark:text-amber-400">
              UNSER
            </p>

            <p className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-300">
              {unserviceable}
            </p>
          </div>

          {/* BER */}
          <div
            className="
                rounded-xl
                border border-red-200
                bg-red-50
                px-1 py-1.5
                text-center
                dark:border-red-800
                dark:bg-red-950/40
            "
          >
            <p className="text-xs font-semibold tracking-wide text-red-600 dark:text-red-400">
              BER
            </p>

            <p className="mt-1 text-lg font-bold text-red-700 dark:text-red-300">
              {ber}
            </p>
          </div>
        </div>

        {/* Source Breakdown */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          {/* Organic */}
          <div
            className="
                rounded-xl
                border border-slate-200 dark:border-slate-800
                bg-slate-50 dark:bg-slate-950
                px-1 py-1.5
                text-center
            "
          >
            <p className="text-xs font-semibold tracking-wide text-slate-900 dark:text-white">
              ORG
            </p>

            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              {organic}
            </p>
          </div>

          {/* Donated */}
          <div
            className="
                rounded-xl
                border border-slate-200 dark:border-slate-800
                bg-slate-50 dark:bg-slate-950
                px-1 py-1.5
                text-center
            "
          >
            <p className="text-xs font-semibold tracking-wide text-slate-900 dark:text-white">
              DON
            </p>

            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              {donated}
            </p>
          </div>

          {/* Loaned */}
          <div
            className="
                rounded-xl
                border border-slate-200 dark:border-slate-800
                bg-slate-50 dark:bg-slate-950
                px-1 py-1.5
                text-center
            "
          >
            <p className="text-xs font-semibold tracking-wide text-slate-900 dark:text-white">
              LOA
            </p>

            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              {loaned}
            </p>
          </div>
        </div>
        {/* Hover action
        <div
          className="
            mt-4
            flex items-center justify-between
            border-t border-slate-100
            pt-3
            opacity-0
            transition-opacity duration-300
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
