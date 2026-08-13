import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import BrowserFrame from "./showcase/BrowserFrame";
import HeroBackground from "./HeroBackground";
import MouseGlow from "./MouseGlow";
import { Link } from "react-router-dom";

export default function HeroSection() {
  const scrollToWorkflow = () => {
    const section = document.getElementById("workflow");

    if (!section) return;

    const y = section.getBoundingClientRect().top + window.pageYOffset - 90; // height of your navbar

    window.scrollTo({
      top: y,
      behavior: "smooth",
    });
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      {/* Background */}
      <MouseGlow />

      <HeroBackground />

      <div
        id="home"
        className="relative mx-auto flex min-h-screen max-w-7xl items-center px-6 py-24"
      >
        <div className="grid items-center gap-20 lg:grid-cols-2">
          {/* LEFT */}

          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
          >
            {/* Title */}

            <h1 className="text-5xl font-black leading-tight md:text-7xl">
              Project
              <span className="block text-blue-600">MOBILIS</span>
            </h1>

            {/* Subtitle */}

            <p className="mt-8 max-w-2xl text-xl leading-9 text-slate-600 dark:text-slate-400">
              Project MOBILIS centralizes mobility management, maintenance,
              inspections, and operational reporting into one secure platform
              for the Ilocos Norte Police Provincial Office.
            </p>

            {/* Buttons */}

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/login"
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-4 font-semibold text-white transition hover:bg-blue-700"
              >
                Access system
              </Link>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={scrollToWorkflow}
                className="rounded-xl border border-slate-300 px-7 py-4 font-semibold transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                System Workflow
              </motion.button>
            </div>
          </motion.div>

          {/* RIGHT */}

          <motion.div
            initial={{
              opacity: 0,
              x: 40,
            }}
            animate={{
              opacity: 1,
              x: 0,
              y: [0, -10, 0],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative"
          >
            <BrowserFrame
              title="MOBILIS Dashboard"
              image="/screenshots/dashboard.png"
            />
          </motion.div>
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

      <span className="font-semibold">{title}</span>
    </div>
  );
}
