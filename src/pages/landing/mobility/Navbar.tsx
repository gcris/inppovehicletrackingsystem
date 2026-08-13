import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const page = location.pathname;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
    };

    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
      className={`fixed left-0 top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "bg-white/80 shadow-lg backdrop-blur-xl dark:bg-slate-900/80"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <img
            src={
              page === "/mobility"
                ? "/assets/mobilis-logo.png"
                : "/assets/app-logo.png"
            }
            alt={page === "/mobility" ? "Project MOBILIS" : "Project JOEMAR"}
            className="h-12 w-12 object-contain border border-slate-200 dark:border-white rounded"
          />

          <div className="flex flex-col justify-center text-black dark:text-white">
            <div className="text-xl font-bold tracking-tight">
              Project {page === "/mobility" ? "MOBILIS" : "JOEMAR"}
            </div>
            <div className="text-sm font-medium tracking-wide">
              {page === "/mobility"
                ? "Mobility Operations, Maintenance, & Inspection Logistics Information System"
                : "Joint Operations, Electronic Monitoring, and Asset Resource-Management System"}
            </div>
          </div>
        </div>

        <nav className="hidden items-center gap-10 lg:flex">
          <a href="#home" className="hover:text-blue-600">
            Home
          </a>

          {page === "/mobility" && (
            <>
              <a href="#workflow" className="hover:text-blue-600">
                System Workflow
              </a>
              <a href="#showcase" className="hover:text-blue-600">
                Showcase
              </a>
              <a href="#about" className="hover:text-blue-600">
                About
              </a>
            </>
          )}

          {page === "/" && (
            <>
              <a href="#features" className="hover:text-blue-600">
                Features
              </a>
              <a href="#mobile" className="hover:text-blue-600">
                Mobile Companion
              </a>
              <a href="#team" className="hover:text-blue-600">
                Team
              </a>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="rounded-xl bg-blue-700 px-5 py-2 text-white transition hover:bg-blue-800"
          >
            Login
          </Link>

          <button className="rounded-lg p-2 lg:hidden">
            <Menu />
          </button>
        </div>
      </div>
    </motion.header>
  );
}
