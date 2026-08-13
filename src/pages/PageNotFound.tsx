import { Link } from "react-router-dom";
import { Home, ArrowLeft, Search } from "lucide-react";

export default function PageNotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-6 dark:bg-slate-950">
      {/* Animated background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[10%] top-[15%] h-32 w-32 animate-pulse rounded-full bg-blue-200/30 blur-2xl dark:bg-blue-700/10" />

        <div
          className="absolute right-[10%] top-[20%] h-40 w-40 animate-pulse rounded-full bg-indigo-200/30 blur-3xl dark:bg-indigo-700/10"
          style={{ animationDelay: "700ms" }}
        />

        <div
          className="absolute bottom-[10%] left-[20%] h-40 w-40 animate-pulse rounded-full bg-cyan-200/20 blur-3xl dark:bg-cyan-700/10"
          style={{ animationDelay: "1200ms" }}
        />

        <div
          className="absolute bottom-[15%] right-[15%] h-24 w-24 animate-pulse rounded-full bg-blue-200/20 blur-2xl dark:bg-blue-700/10"
          style={{ animationDelay: "400ms" }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-lg text-center">
        {/* Floating icon */}
        <div className="animate-[float_3s_ease-in-out_infinite]">
          <div className="relative mx-auto mb-7 flex h-28 w-28 items-center justify-center rounded-[2rem] border border-blue-200 bg-white shadow-xl shadow-blue-500/10 dark:border-blue-900/50 dark:bg-slate-900">
            {/* Rotating ring */}
            <div className="absolute inset-[-8px] animate-[spin_12s_linear_infinite] rounded-[2.4rem] border border-dashed border-blue-300/60 dark:border-blue-700/40" />

            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30">
              <Search
                size={42}
                strokeWidth={1.8}
                className="text-blue-600 dark:text-blue-400"
              />
            </div>
          </div>
        </div>

        {/* 404 */}
        <div className="animate-[fadeUp_700ms_ease-out]">
          <h1 className="bg-gradient-to-b from-slate-800 to-slate-500 bg-clip-text text-8xl font-black tracking-tighter text-transparent dark:from-white dark:to-slate-500 sm:text-9xl">
            404
          </h1>
        </div>

        {/* Title */}
        <div
          className="animate-[fadeUp_700ms_ease-out]"
          style={{ animationDelay: "150ms", animationFillMode: "both" }}
        >
          <h2 className="mt-2 text-2xl font-bold text-slate-800 dark:text-slate-100 sm:text-3xl">
            Page Not Found
          </h2>

          <p className="mx-auto mt-4 max-w-md text-base leading-7 text-slate-500 dark:text-slate-400">
            The page you're looking for doesn't exist, has been moved, or may no
            longer be available.
          </p>
        </div>

        {/* Buttons */}
        <div
          className="mt-8 flex animate-[fadeUp_700ms_ease-out] flex-col justify-center gap-3 sm:flex-row"
          style={{ animationDelay: "300ms", animationFillMode: "both" }}
        >
          <button
            type="button"
            onClick={() => window.history.back()}
            className="group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          >
            <ArrowLeft
              size={18}
              className="transition-transform duration-300 group-hover:-translate-x-1"
            />
            Go Back
          </button>

          <Link
            to="/"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition-all duration-300 hover:-translate-y-1 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30"
          >
            <Home
              size={18}
              className="transition-transform duration-300 group-hover:scale-110"
            />
            Go Home
          </Link>
        </div>
      </div>

      {/* Custom animations */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }

          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
