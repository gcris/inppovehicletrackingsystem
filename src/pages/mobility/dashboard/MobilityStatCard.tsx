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
};

export default function MobilityStatCard({
  title,
  value,
  bg_color,
  border_color,
}: Props) {
  return (
    <Link
      to={`/mobility-assets?query=${encodeURIComponent(title)}`}
      className={`
        group relative block overflow-hidden rounded-2xl
        border ${border_color}
        ${bg_color}
        shadow-sm
        transition-all duration-300
        hover:-translate-y-1
        hover:shadow-lg
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
      <div
        className="
          absolute -right-8 -top-8
          h-24 w-24 rounded-full
          dark:bg-white/10
          bg-slate-300/10
          transition-transform duration-500
          group-hover:scale-150
        "
      />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-slate-600 dark:text-slate-300">
              {title}
            </p>
          </div>
        </div>

        {/* Number */}
        <h2 className="mt-5 text-4xl font-black tracking-tight text-slate-900 dark:text-white">
          {value.toLocaleString()}
        </h2>

        {/* Hover-only details */}
        <div
          className="
            pointer-events-none
            absolute bottom-1 left-5 right-5
            translate-y-3
            opacity-0
            transition-all duration-300
            group-hover:translate-y-0
            group-hover:opacity-100
          "
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-500 dark:text-slate-400">
              View details
            </span>

            <span className="font-bold text-blue-600 dark:text-blue-400">
              →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
