
import { useCallback, useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  LogIn,
  MapPinned,
  Navigation,
  Pause,
  Play,
  Radio,
  ShieldCheck,
  Users,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                  DATA                                      */
/* -------------------------------------------------------------------------- */

const patrolFeatures = [
  {
    title: "Project PATROL Log In",
    description:
      "Securely access the Project P.A.T.R.O.L. application to view authorized features and manage patrol-related activities based on your assigned role.",
    icon: LogIn,
    color: "from-blue-500 to-cyan-500",
    lightColor:
      "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  },
  {
    title: "Dashboard",
    description:
      "View an overview of patrol operations, personnel deployment, scheduled activities, and patrol statistics to support operational monitoring and decision-making.",
    icon: BarChart3,
    color: "from-emerald-500 to-teal-500",
    lightColor:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  {
    title: "Distress Signal",
    description:
      "Send an emergency distress alert to notify designated personnel of urgent situations and help facilitate a timely response.",
    icon: ShieldCheck,
    color: "from-violet-500 to-purple-500",
    lightColor:
      "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  },
  {
    title: "Recent Patrol Logs",
    description:
      "Review recently recorded patrol activities, including location updates, patrol routes, timestamps, and other available tracking details.",
    icon: Navigation,
    color: "from-emerald-500 to-teal-500",
    lightColor:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  {
    title: "Patrol Summary",
    description:
      "Generate and review consolidated patrol reports to monitor personnel participation, patrol activities, deployment coverage, and operational performance.",
    icon: Users,
    color: "from-orange-500 to-amber-500",
    lightColor:
      "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300",
  },
];

const operationalHighlights = [
  {
    title: "Operational Visibility",
    description:
      "Monitor patrol deployment and visualize operational areas using location-based information.",
    icon: Navigation,
  },
  {
    title: "Personnel Coordination",
    description:
      "Organize personnel assignments and patrol schedules for coordinated field operations.",
    icon: Users,
  },
  {
    title: "Performance Analysis",
    description:
      "Review patrol summaries, activity reports, and operational insights to support decision-making.",
    icon: BarChart3,
  },
];

const patrolImages = [
  {
    src: "/assets/mobile-app/login.jpg",
    alt: "Project P.A.T.R.O.L. mobile application login screen",
    title: "Log In",
  },
  {
    src: "/assets/mobile-app/dashboard.jpg",
    alt: "Project P.A.T.R.O.L. mobile dashboard",
    title: "Mobile Dashboard",
  },
  {
    src: "/assets/mobile-app/distress-signal.jpg",
    alt: "Project P.A.T.R.O.L. mobile distress signal screen",
    title: "Mobile Distress Signal",
  },
  {
    src: "/assets/mobile-app/recent-logs.jpg",
    alt: "Project P.A.T.R.O.L. recent patrol logs",
    title: "Recent Patrol Logs",
  },
  {
    src: "/assets/mobile-app/patrol-summary.jpg",
    alt: "Project P.A.T.R.O.L. patrol summary screen",
    title: "Patrol Summary",
  },
];

const benefits = [
  {
    title: "Improved situational awareness",
    description:
      "View patrol locations and mapped operational areas to better understand deployment coverage.",
  },
  {
    title: "Organized deployment",
    description:
      "Coordinate personnel assignments and patrol schedules through a centralized platform.",
  },
  {
    title: "Data-informed decisions",
    description:
      "Use patrol summaries and analytics to review activities and evaluate operational performance.",
  },
];

/* -------------------------------------------------------------------------- */
/*                              ABOUT SECTION                                 */
/* -------------------------------------------------------------------------- */

const AUTOPLAY_INTERVAL = 5000;

export default function AboutSection() {
  const [activeImage, setActiveImage] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const nextImage = useCallback(() => {
    setActiveImage((current) => (current + 1) % patrolImages.length);
  }, []);

  const previousImage = useCallback(() => {
    setActiveImage(
      (current) =>
        (current - 1 + patrolImages.length) % patrolImages.length,
    );
  }, []);

  useEffect(() => {
    if (
      isPaused ||
      prefersReducedMotion ||
      patrolImages.length <= 1
    ) {
      return;
    }

    const timer = window.setInterval(
      nextImage,
      AUTOPLAY_INTERVAL,
    );

    return () => window.clearInterval(timer);
  }, [isPaused, prefersReducedMotion, nextImage]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <section className="relative isolate overflow-hidden bg-white text-slate-800 dark:bg-slate-900/50 dark:text-slate-100">
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 py-12 sm:gap-12 sm:px-8 sm:py-16 lg:grid-cols-2 lg:gap-16 lg:px-12 lg:py-20">
          {/* Hero text */}
          <motion.div
            initial={
              prefersReducedMotion ? false : { opacity: 0, y: 24 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 font-semibold text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Ilocos Norte Police Provincial Office
            </div>

            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-5xl">
              Project{" "}
              <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 bg-clip-text text-transparent">
                P.A.T.R.O.L.
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-blue-600 dark:text-blue-400">
              Personnel App Tracking and Real-Time OnLine Deployment Monitoring
            </p>

            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
              A digital platform designed to strengthen police operations
              through real-time patrol monitoring, personnel coordination,
              geographical sector mapping, activity scheduling, and
              performance analysis for the Ilocos Norte Police Provincial
              Office.
            </p>

            {/* Feature highlights */}
            <div className="mt-8 flex flex-wrap gap-3">
              {[
                {
                  label: "Real-Time Monitoring",
                  icon: Radio,
                },
                {
                  label: "Geographic Mapping",
                  icon: MapPinned,
                },
                {
                  label: "Operational Analytics",
                  icon: BarChart3,
                },
              ].map(({ label, icon: Icon }, index) => (
                <motion.div
                  key={label}
                  initial={
                    prefersReducedMotion ? false : { opacity: 0, y: 12 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Icon className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  {label}
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Mobile app carousel */}
          <motion.div
            initial={
              prefersReducedMotion ? false : { opacity: 0, x: 30 }
            }
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="relative mx-auto w-full max-w-xl"
          >
            {/* Glow effect */}
            <div
              aria-hidden="true"
              className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-blue-400/20 via-indigo-400/15 to-violet-400/20 blur-3xl"
            />

            <div
              className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_25px_100px_rgba(96,120,255,0.15)] dark:border-slate-700 dark:bg-slate-800"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              onFocusCapture={() => setIsPaused(true)}
              onBlurCapture={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                ) {
                  setIsPaused(false);
                }
              }}
            >
              {/* Screenshot area */}
              <div className="relative flex h-[350px] items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-900 sm:h-[450px]">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={patrolImages[activeImage].src}
                    src={patrolImages[activeImage].src}
                    alt={patrolImages[activeImage].alt}
                    initial={
                      prefersReducedMotion
                        ? false
                        : { opacity: 0, scale: 0.985 }
                    }
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.985 }}
                    transition={{ duration: 0.3 }}
                    className="h-full w-full object-contain"
                    loading="eager"
                    draggable={false}
                  />
                </AnimatePresence>

                {/* Previous slide */}
                <button
                  type="button"
                  onClick={previousImage}
                  aria-label="Previous app screenshot"
                  className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-md transition hover:scale-105 hover:bg-blue-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                {/* Next slide */}
                <button
                  type="button"
                  onClick={nextImage}
                  aria-label="Next app screenshot"
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-md transition hover:scale-105 hover:bg-blue-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {/* Caption and carousel controls */}
              <div className="border-t border-slate-200 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center justify-center gap-2">
                  {patrolImages.map((image, index) => (
                    <button
                      key={image.src}
                      type="button"
                      onClick={() => setActiveImage(index)}
                      aria-label={`Show ${image.title}`}
                      aria-current={
                        activeImage === index ? "true" : undefined
                      }
                      className={`h-2.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                        activeImage === index
                          ? "w-8 bg-blue-600"
                          : "w-2.5 bg-slate-300 hover:bg-blue-400"
                      }`}
                    />
                  ))}

                  {/* Pause / resume */}
                  <button
                    type="button"
                    onClick={() => setIsPaused((paused) => !paused)}
                    aria-label={
                      isPaused ? "Resume carousel" : "Pause carousel"
                    }
                    title={
                      isPaused ? "Resume slideshow" : "Pause slideshow"
                    }
                    className="ml-2 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-blue-400"
                  >
                    {isPaused ? (
                      <Play className="h-4 w-4" />
                    ) : (
                      <Pause className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* ABOUT THE PROJECT                                                  */}
      {/* ------------------------------------------------------------------ */}

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
        <motion.div
          initial={
            prefersReducedMotion ? false : { opacity: 0, y: 20 }
          }
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
            <ShieldCheck className="h-4 w-4" />
            About the Project
          </span>

          <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            A Smarter Approach to Police Operations
          </h2>

          <p className="mt-6 leading-8 text-slate-600 dark:text-slate-300">
            Project P.A.T.R.O.L. provides a centralized platform
            for organizing patrol activities, monitoring personnel
            deployment, visualizing operational areas, and reviewing
            performance. It brings essential operational information
            together to help authorized personnel make informed
            decisions and coordinate police activities more
            effectively.
          </p>
        </motion.div>

        {/* Operational highlights */}
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {operationalHighlights.map((item, index) => {
            const Icon = item.icon;

            return (
              <motion.div
                key={item.title}
                initial={
                  prefersReducedMotion
                    ? false
                    : { opacity: 0, y: 20 }
                }
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.12,
                }}
                viewport={{ once: true }}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                  <Icon className="h-6 w-6" />
                </div>

                <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">
                  {item.title}
                </h3>

                <p className="mt-2 leading-7 text-slate-600 dark:text-slate-400">
                  {item.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CORE FEATURES                                                       */}
      {/* ------------------------------------------------------------------ */}

      <section className="border-y border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-900/50 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
          <motion.div
            initial={
              prefersReducedMotion ? false : { opacity: 0, y: 20 }
            }
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              <CheckCircle2 className="h-4 w-4" />
              Core Features
            </span>

            <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Everything for Patrol Coordination
            </h2>

            <p className="mt-5 leading-8 text-slate-600 dark:text-slate-300">
              Explore the tools that support patrol monitoring,
              personnel deployment, scheduling, geographical
              awareness, and operational reporting.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {patrolFeatures.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <motion.article
                  key={feature.title}
                  initial={
                    prefersReducedMotion
                      ? false
                      : { opacity: 0, y: 24 }
                  }
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: (index % 3) * 0.1,
                  }}
                  viewport={{ once: true, amount: 0.15 }}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
                >
                  <div
                    aria-hidden="true"
                    className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${feature.color} opacity-80 transition-all group-hover:h-1.5`}
                  />

                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl ${feature.lightColor}`}
                  >
                    <Icon className="h-7 w-7" />
                  </div>

                  <h3 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">
                    {feature.title}
                  </h3>

                  <p className="mt-3 leading-7 text-slate-600 dark:text-slate-400">
                    {feature.description}
                  </p>

                  <div
                    aria-hidden="true"
                    className={`mt-6 h-1 w-12 rounded-full bg-gradient-to-r ${feature.color} transition-all duration-300 group-hover:w-20`}
                  />
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* OPERATIONAL BENEFITS                                                */}
      {/* ------------------------------------------------------------------ */}

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Benefits text */}
          <motion.div
            initial={
              prefersReducedMotion
                ? false
                : { opacity: 0, x: -20 }
            }
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Operational Benefits
            </span>

            <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Supporting Effective and Accountable Deployment
            </h2>

            <p className="mt-5 leading-8 text-slate-600 dark:text-slate-300">
              By consolidating patrol information into one platform,
              Project P.A.T.R.O.L. helps authorized users coordinate
              assignments, understand deployment coverage, and
              evaluate operational activities.
            </p>

            <div className="mt-8 space-y-5">
              {benefits.map((benefit) => (
                <div
                  key={benefit.title}
                  className="flex gap-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">
                      {benefit.title}
                    </h3>

                    <p className="mt-1 leading-7 text-slate-600 dark:text-slate-400">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Benefits panel */}
          <motion.div
            initial={
              prefersReducedMotion
                ? false
                : { opacity: 0, x: 20 }
            }
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 p-7 text-white shadow-xl sm:p-10"
          >
            <div
              aria-hidden="true"
              className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl"
            />

            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
                <ShieldCheck className="h-7 w-7 text-cyan-300" />
              </div>

              <p className="mt-6 text-2xl font-extrabold text-white sm:text-3xl">
                One Platform. Coordinated Operations.
              </p>

              <p className="mt-4 leading-8 text-blue-100">
                From personnel management to live tracking and
                performance analysis, Project P.A.T.R.O.L. brings
                key patrol functions together in a unified
                operational environment.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  "Real-time patrol monitoring",
                  "Sector and strategic-location mapping",
                  "Personnel and activity scheduling",
                  "Patrol summaries and analytics",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3"
                  >
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-300" />
                    <span className="font-medium text-blue-50">
                      {item}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex items-center gap-3 border-t border-white/15 pt-6">
                <Clock className="h-5 w-5 shrink-0 text-cyan-300" />

                <p className="leading-6 text-blue-100">
                  Designed to support timely monitoring and
                  coordinated police operations.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CLOSING STATEMENT                                                   */}
      {/* ------------------------------------------------------------------ */}

      <section className="px-5 pb-16 sm:px-8 sm:pb-20 lg:px-12">
        <motion.div
          initial={
            prefersReducedMotion ? false : { opacity: 0, y: 20 }
          }
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 px-6 py-12 text-center shadow-xl sm:px-12 sm:py-16"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl"
          />

          <div className="relative mx-auto max-w-3xl">
            <ShieldCheck className="mx-auto h-12 w-12 text-cyan-300" />

            <p className="mt-5 text-2xl font-extrabold text-white sm:text-4xl">
              Smarter Monitoring. Stronger Police Operations.
            </p>

            <p className="mt-5 leading-8 text-blue-100">
              Project P.A.T.R.O.L. supports the digital
              transformation of the Ilocos Norte Police Provincial
              Office through real-time patrol monitoring, personnel
              coordination, sector mapping, scheduling, and
              operational performance analysis.
            </p>

            <p className="mt-6 font-semibold tracking-wide text-cyan-200">
              ILOCOS NORTE POLICE PROVINCIAL OFFICE
            </p>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
