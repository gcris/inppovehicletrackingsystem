import { motion } from "framer-motion";
import {
  ShieldCheck,
  Car,
  Wrench,
  ClipboardCheck,
  BarChart3,
} from "lucide-react";

export default function AboutSection() {
  return (
    <section
      id="about"
      className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-32"
    >
      {/* ===============================
           Background Decorations
      =============================== */}

      <div className="absolute inset-0 -z-10 overflow-hidden">
        {/* Blue Glow */}
        <div className="absolute left-1/2 top-16 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-blue-300/20 blur-[140px]" />

        {/* Cyan Glow */}
        <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-cyan-200/20 blur-[120px]" />

        {/* Indigo Glow */}
        <div className="absolute left-0 bottom-20 h-96 w-96 rounded-full bg-indigo-200/20 blur-[120px]" />

        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(to right,#2563eb 1px,transparent 1px),
              linear-gradient(to bottom,#2563eb 1px,transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* ===============================
            Content
      =============================== */}

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl text-center"
        >
          {/* Badge */}

          <span className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
            About Project MOBILIS
          </span>

          {/* Title */}

          <h2 className="mt-8 text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl">
            Transforming
            <span className="block bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              Mobility Operations, Maintenance, & Inspection Logistics
              Information System
            </span>
          </h2>

          {/* Description */}

          <p className="mx-auto mt-8 max-w-2xl text-lg leading-8 text-slate-600">
            Project <strong>MOBILIS</strong> is a centralized digital platform
            that streamlines mobility asset management through preventive
            maintenance, inspections, monitoring, and operational
            reporting—helping the Ilocos Norte Police Provincial Office improve
            efficiency, accountability, and operational readiness.
          </p>
        </motion.div>

        {/* ===============================
      About JOEMAR
================================ */}

        <div className="mt-24 grid items-center gap-16 lg:grid-cols-2">
          {/* =================================
      Left Illustration
  ================================= */}

          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              {/* Top Bar */}

              <div className="flex items-center gap-2 border-b bg-slate-50 px-6 py-4">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />

                <span className="ml-4 text-sm font-medium text-slate-500">
                  Project MOBILIS Dashboard
                </span>
              </div>

              {/* Dashboard Placeholder */}

              <div className="space-y-6 p-8">
                <div className="h-8 w-1/2 rounded bg-blue-100" />

                <div className="grid grid-cols-2 gap-5">
                  <div className="rounded-2xl bg-blue-50 p-6">
                    <Car className="mb-3 h-8 w-8 text-blue-600" />
                    <div className="h-3 w-24 rounded bg-blue-200" />
                  </div>

                  <div className="rounded-2xl bg-orange-50 p-6">
                    <Wrench className="mb-3 h-8 w-8 text-orange-500" />
                    <div className="h-3 w-24 rounded bg-orange-200" />
                  </div>

                  <div className="rounded-2xl bg-green-50 p-6">
                    <ClipboardCheck className="mb-3 h-8 w-8 text-green-600" />
                    <div className="h-3 w-24 rounded bg-green-200" />
                  </div>

                  <div className="rounded-2xl bg-purple-50 p-6">
                    <BarChart3 className="mb-3 h-8 w-8 text-purple-600" />
                    <div className="h-3 w-24 rounded bg-purple-200" />
                  </div>
                </div>

                <div className="h-40 rounded-2xl bg-gradient-to-r from-blue-100 to-cyan-100" />
              </div>
            </div>

            {/* Floating Card */}

            <div className="absolute -right-6 -top-6 rounded-2xl border bg-white px-5 py-4 shadow-xl">
              <div className="text-xs font-semibold uppercase text-slate-500">
                Modules
              </div>

              <div className="mt-1 text-3xl font-bold text-blue-600">4+</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
          >
            <span className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
              What is Project MOBILIS?
            </span>

            <h3 className="mt-4 text-4xl font-bold text-slate-900">
              A Modern Platform for Police Mobility Asset Management
            </h3>

            <p className="mt-6 leading-8 text-slate-600">
              Project <strong>MOBILIS</strong> (Mobility Operations,
              Maintenance, & Inspection Logistics Information System) modernizes
              how police mobility assets are managed by integrating asset
              registration, maintenance, inspections, and operational reporting
              into one centralized information system.
            </p>

            <p className="mt-5 leading-8 text-slate-600">
              Designed for the Ilocos Norte Police Provincial Office, Project
              MOBILIS minimizes manual paperwork, improves accountability,
              enhances operational readiness, and provides reliable data for
              informed decision-making.
            </p>

            {/* Highlights */}

            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <Car className="mb-3 h-8 w-8 text-blue-600" />
                <p className="text-lx font-semibold text-slate-900">
                  Centralized Registry
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  A complete inventory of all mobility assets.
                </p>
              </div>

              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <Wrench className="mb-3 h-8 w-8 text-orange-500" />
                <p className="text-lx font-semibold text-slate-900">
                  Preventive Maintenance Service
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Schedule and record preventive and corrective maintenance.
                </p>
              </div>

              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <ClipboardCheck className="mb-3 h-8 w-8 text-green-600" />
                <p className="text-lx font-semibold text-slate-900">
                  Digital Inspection
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Standardized inspections with historical records.
                </p>
              </div>

              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <BarChart3 className="mb-3 h-8 w-8 text-purple-600" />
                <p className="text-lx font-semibold text-slate-900">
                  Reporting
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Actionable insights through dashboards and reports.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
