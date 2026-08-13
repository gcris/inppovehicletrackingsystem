import { motion } from "framer-motion";

const features = [
  {
    id: 1,
    title: "Live Tracking",
    subtitle: "Real-time GPS Monitoring",
    description:
      "Track deployed personnel in real time with live map visualization, route monitoring, and operational awareness.",
    image: "/screenshots/live-tracking.png",
    icon: "/assets/map.png",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    id: 2,
    title: "Personnel Management",
    subtitle: "Centralized Personnel Records",
    description:
      "Maintain personnel information including rank, designation, assignment, contact details, and unit records.",
    image: "/screenshots/personnel.png",
    icon: "/assets/personnel.png",
    gradient: "from-indigo-500 to-blue-500",
  },
  {
    id: 3,
    title: "Duty Scheduling",
    subtitle: "Smart Schedule Planning",
    description:
      "Create duty schedules, assign personnel, and organize operational deployments efficiently.",
    image: "/screenshots/schedules.png",
    icon: "/assets/duty-schedule.png",
    gradient: "from-orange-500 to-red-500",
  },
  {
    id: 4,
    title: "Calendar",
    subtitle: "Operational Calendar",
    description:
      "View meetings, inspections, patrol schedules, and important activities through an integrated calendar.",
    image: "/screenshots/calendar.png",
    icon: "/assets/calendar.png",
    gradient: "from-green-500 to-emerald-500",
  },
  {
    id: 5,
    title: "Analytics",
    subtitle: "Operational Intelligence",
    description:
      "Generate performance reports and visualize patrol activities using interactive charts and dashboards.",
    image: "/screenshots/analytics.png",
    icon: "/assets/analytics.png",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    id: 6,
    title: "Distress Signal",
    subtitle: "Instant Emergency Response",
    description:
      "Enable personnel to send distress signal with their real-time location, allowing respective units/stations to respond immediately during critical incidents.",
    image: "/screenshots/distress-signal.png",
    icon: "/assets/sos.png",
    gradient: "from-red-500 to-rose-600",
  },
];

export default function PersonnelFeaturesSection() {
  return (
    <section
      id="personnel-features"
      className="
      relative
      overflow-hidden
      py-32
      bg-white
      dark:bg-slate-950
    "
    >
      {/* Background */}

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-0 top-40 h-72 w-72 rounded-full bg-blue-100 blur-3xl opacity-50 dark:bg-blue-900/20" />

        <div className="absolute right-0 bottom-20 h-96 w-96 rounded-full bg-cyan-100 blur-3xl opacity-50 dark:bg-cyan-900/20" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-20 max-w-3xl text-center"
        >
          <p className="font-semibold uppercase tracking-[0.35em] text-blue-600">
            Personnel Operations
          </p>

          <h2 className="mt-8 text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            Project JOEMAR
          </h2>

          <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-400">
            Manage personnel, monitor deployments, organize schedules, and gain
            valuable operational insights from one centralized platform.
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{
                opacity: 0,
                y: 40,
              }}
              whileInView={{
                opacity: 1,
                y: 0,
              }}
              viewport={{ once: true }}
              transition={{
                duration: 0.5,
                delay: index * 0.08,
              }}
              whileHover={{
                y: -10,
              }}
              className="
                group
                overflow-hidden
                rounded-3xl
                border
                border-slate-200
                bg-white
                shadow-xl
                transition-all
                dark:border-slate-800
                dark:bg-slate-900
                "
            >
              {/* Fake Window Header */}

              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
                <span className="h-3 w-3 rounded-full bg-red-400"></span>
                <span className="h-3 w-3 rounded-full bg-yellow-400"></span>
                <span className="h-3 w-3 rounded-full bg-green-400"></span>

                <div className="ml-auto text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Module {feature.id}
                </div>
              </div>

              {/* Screenshot */}

              <div className="relative overflow-hidden bg-slate-100 dark:bg-slate-950">
                <img
                  src={feature.image}
                  alt={feature.title}
                  className="
                    h-64
                    w-full
                    object-cover
                    transition-transform
                    duration-700
                    group-hover:scale-105
                "
                />

                {/* Gradient */}

                <div
                  className={`
                    absolute
                    inset-0
                    bg-gradient-to-t
                    ${feature.gradient}
                    opacity-10
                `}
                />

                {/* Floating Icon */}

                <motion.div
                  whileHover={{
                    rotate: 10,
                    scale: 1.08,
                  }}
                  className="
                    absolute
                    left-6
                    bottom-6
                    flex
                    h-16
                    w-16
                    items-center
                    justify-center
                    rounded-2xl
                    bg-white
                    shadow-xl
                    dark:bg-slate-900
                "
                >
                  <img
                    src={feature.icon}
                    alt={feature.title}
                    className="h-10 w-10 object-contain"
                  />
                </motion.div>
              </div>

              {/* Content */}

              <div className="p-7">
                <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
                  {feature.subtitle}
                </p>

                <h3 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
                  {feature.title}
                </h3>

                <p className="mt-4 leading-7 text-slate-500 dark:text-slate-400">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Feature Showcase */}

        <div id="features" className="mt-32 space-y-32">
          <div className="py-28 mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center">
              <p className="font-semibold uppercase tracking-[0.35em] text-blue-600">
                Features of the System
              </p>
            </div>
            {features.map((feature, index) => (
              <motion.div
                key={`showcase-${feature.id}`}
                initial={{
                  opacity: 0,
                  y: 60,
                }}
                whileInView={{
                  opacity: 1,
                  y: 0,
                }}
                viewport={{
                  once: true,
                  amount: 0.3,
                }}
                transition={{
                  duration: 0.7,
                }}
                className={`
                    grid
                    items-center
                    gap-16
                    lg:grid-cols-2

                    ${index % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""}
                `}
              >
                {/* LEFT */}

                <div>
                  <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    Feature {feature.id}
                  </span>

                  <h2 className="mt-8 text-4xl font-black text-slate-900 dark:text-white">
                    {feature.title}
                  </h2>

                  <h4 className="mt-3 text-xl font-semibold text-blue-600">
                    {feature.subtitle}
                  </h4>

                  <p className="mt-8 text-lg leading-8 text-slate-600 dark:text-slate-400">
                    {feature.description}
                  </p>

                  <ul className="mt-10 space-y-4">
                    <li className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                      Real-time information
                    </li>

                    <li className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                      Secure centralized records
                    </li>

                    <li className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                      Modern responsive interface
                    </li>
                  </ul>
                </div>

                {/* RIGHT */}

                <motion.div
                  whileHover={{
                    y: -10,
                  }}
                  transition={{
                    duration: 0.3,
                  }}
                  className="relative"
                >
                  <div
                    className={`
                        absolute
                        -inset-6
                        rounded-[3rem]
                        bg-gradient-to-br
                        ${feature.gradient}
                        opacity-20
                        blur-3xl
                    `}
                  />

                  <div
                    className="
                        relative
                        overflow-hidden
                        rounded-[2rem]
                        border
                        border-slate-200
                        bg-white
                        shadow-2xl

                        dark:border-slate-800
                        dark:bg-slate-900
                    "
                  >
                    {/* Window Header */}

                    <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
                      <span className="h-3 w-3 rounded-full bg-red-400"></span>
                      <span className="h-3 w-3 rounded-full bg-yellow-400"></span>
                      <span className="h-3 w-3 rounded-full bg-green-400"></span>

                      <div className="ml-auto flex items-center gap-3">
                        <img src={feature.icon} className="h-6 w-6" />

                        <span className="text-sm font-semibold text-slate-500">
                          {feature.title}
                        </span>
                      </div>
                    </div>

                    <img
                      src={feature.image}
                      alt={feature.title}
                      className="
                        w-full
                        object-cover
                        transition-transform
                        duration-700
                        hover:scale-105
                    "
                    />
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
