import {
  Smartphone,
  MapPinned,
  ShieldCheck,
  Cloud,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { FaGithub } from "react-icons/fa";

const screenshots = [
  {
    image: "/mobile/splash.png",
    title: "Project JOEMAR",
  },
  {
    image: "/mobile/login.png",
    title: "Log in",
  },
  {
    image: "/mobile/google-auth.png",
    title: "Secured app using Google Authenticator",
  },
  {
    image: "/mobile/dashboard.png",
    title: "Dashboard",
  },
  {
    image: "/mobile/selection.png",
    title: "Selection of Duty/Activity Type",
  },
  {
    image: "/mobile/on-patrolling.png",
    title: "On patrolling",
  },
];

export default function TrackingSection() {
  const [current, setCurrent] = useState(0);

  const next = () => {
    setCurrent((prev) => (prev + 1) % screenshots.length);
  };

  const previous = () => {
    setCurrent((prev) => (prev === 0 ? screenshots.length - 1 : prev - 1));
  };

  useEffect(() => {
    const timer = setInterval(next, 4000);

    return () => clearInterval(timer);
  }, [current]);

  return (
    <section id="mobile" className="bg-slate-100 py-28 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center">
          <p className="font-semibold uppercase tracking-[0.35em] text-blue-600">
            Mobile Companion
          </p>
        </div>
        <div className="grid items-center gap-16 lg:grid-cols-2">
          {/* Left Side */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="mt-2">
              <div
                className="
                overflow-hidden
                rounded-3xl
                border
                border-slate-200
                bg-white
                shadow-xl
                dark:border-slate-800
                dark:bg-slate-900
              "
              >
                <div className="grid gap-8 lg:grid-cols-[1fr_auto] p-8">
                  {/* Left */}
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-1 text-sm font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <Smartphone className="h-5 w-5" />
                      Android Application
                    </div>

                    <h3 className="mt-5 text-3xl font-bold text-slate-900 dark:text-white">
                      Download Patrol Tracking App
                    </h3>

                    <p className="mt-4 max-w-2xl text-slate-600 dark:text-slate-400 leading-7">
                      Install the Android application to record patrol
                      activities, synchronize location logs, receive SOS
                      notifications, and submit patrol reports directly from the
                      field.
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3 text-sm">
                      <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                        Android 10+
                      </span>

                      <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                        Latest Release
                      </span>

                      <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                        Free
                      </span>
                    </div>
                  </div>

                  {/* Right */}
                  <div className="flex flex-col justify-center gap-4">
                    <a
                      href="https://github.com/gcris/JOEMARMobileApp/releases/tag/v1.0.0-beta.1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="
                      inline-flex
                      items-center
                      justify-center
                      gap-2
                      rounded-2xl
                      bg-blue-600
                      px-6
                      py-4
                      font-semibold
                      text-white
                      transition
                      hover:bg-blue-700
                    "
                    >
                      <Download className="h-5 w-5" />
                      Download APK
                    </a>

                    <a
                      href="https://github.com/gcris/JOEMARMobileApp"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="
                      inline-flex
                      items-center
                      justify-center
                      gap-2
                      rounded-2xl
                      border
                      border-slate-300
                      px-6
                      py-4
                      font-semibold
                      transition
                      hover:bg-slate-100
                      dark:border-slate-700
                      dark:hover:bg-slate-800
                    "
                    >
                      <FaGithub className="h-5 w-5" />
                      View on GitHub
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Side */}
          <div className="relative mx-auto mt-16 max-w-md">
            <button
              onClick={previous}
              className="absolute left-0 top-1/2 -translate-x-16 -translate-y-1/2 rounded-full bg-white p-3 shadow-lg hover:bg-slate-100"
            >
              <ChevronLeft />
            </button>

            <button
              onClick={next}
              className="absolute right-0 top-1/2 translate-x-16 -translate-y-1/2 rounded-full bg-white p-3 shadow-lg hover:bg-slate-100"
            >
              <ChevronRight />
            </button>

            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, x: 80 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -80 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <div className="mx-auto overflow-hidden rounded-[2.5rem] border-[10px] border-slate-900 shadow-2xl w-[280px]">
                  <img
                    src={screenshots[current].image}
                    className="h-[560px] w-full object-cover"
                    alt={screenshots[current].title}
                  />
                </div>

                <h3 className="mt-8 text-2xl font-bold">
                  {screenshots[current].title}
                </h3>
              </motion.div>
            </AnimatePresence>
            <div className="mt-8 flex justify-center gap-3">
              {screenshots.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrent(index)}
                  className={`h-3 rounded-full transition-all ${
                    current === index ? "w-10 bg-blue-600" : "w-3 bg-slate-300"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Feature({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="rounded-xl bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/30">
        {icon}
      </div>

      <span className="font-semibold text-slate-800 dark:text-white">
        {title}
      </span>
    </div>
  );
}
