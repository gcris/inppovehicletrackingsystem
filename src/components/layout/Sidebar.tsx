import { useLocation } from "react-router-dom";
import { useAuth } from "../../components/AuthProvider";
import { useSidebar } from "../../hooks/useSidebar";
import { SidebarItem } from "./SidebarItem";
import {
  BarChart3,
  ChevronDown,
  FileText,
  Info,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";

interface MenuItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  for: string[];
}

/**
 * Sidebar component with collapse/expand functionality
 */
export const Sidebar = () => {
  const { isCollapsed, toggleSidebar } = useSidebar();
  const location = useLocation();
  const { profile } = useAuth();

  const profileRole = profile?.role;

  // Define main menu items (matches the structure in App.tsx)
  const mainMenuItems: MenuItem[] = [
    {
      href: "/dashboard",
      icon: (
        <img src="/assets/dashboard.png" alt="Dashboard" className="w-7 h-7" />
      ),
      label: "Dashboard",
      for: ["operation", "admin"],
    },
    {
      href: "/map",
      icon: <img src="/assets/map.png" alt="Map" className="w-7 h-7" />,
      label: "Live Tracking",
      for: ["operation", "admin"],
    },
    {
      href: "/personnel",
      icon: (
        <img src="/assets/personnel.png" alt="Personnel" className="w-7 h-7" />
      ),
      label: "Personnel List",
      for: ["operation", "admin"],
    },
    {
      href: "/schedule",
      icon: (
        <img
          src="/assets/patrol-schedule.png"
          alt="Schedules"
          className="w-7 h-7"
        />
      ),
      label: "Schedules",
      for: ["operation", "admin"],
    },
    {
      href: "/dashboard-mobility",
      icon: (
        <img src="/assets/dashboard.png" alt="Dashboard" className="w-7 h-7" />
      ),
      label: "Dashboard",
      for: ["supply", "admin_supply"],
    },
    {
      href: "/mobility-assets",
      icon: (
        <img
          src="/assets/mobility-assets.png"
          alt="Mobility Assets"
          className="w-7 h-7"
        />
      ),
      label: "Mobility Assets",
      for: ["supply", "admin", "admin_supply"],
    },
    {
      href: "/pms-history",
      icon: (
        <img
          src="/assets/maintenance.png"
          alt="PMS History"
          className="w-7 h-7"
        />
      ),
      label: "PMS History",
      for: ["supply", "admin", "admin_supply"],
    },
    {
      href: "/mobility-inspection",
      icon: (
        <img
          src="/assets/vehicle-inspection.png"
          alt="Mobility Inspection"
          className="w-7 h-7"
        />
      ),
      label: "Mobility Inspection",
      for: ["supply", "admin", "admin_supply"],
    },
    {
      href: "/calendar",
      icon: (
        <img src="/assets/calendar.png" alt="Calendar" className="w-7 h-7" />
      ),
      label: "Calendar",
      for: ["operation", "admin"],
    },
  ];

  // Define settings items (the ones after the separator in App.tsx)
  const settingsItems: MenuItem[] = [
    {
      href: "/analytics",
      icon: <BarChart3 className="w-7 h-7" />,
      label: "Analytics",
      for: ["operation", "admin"],
    },
    {
      href: "/pms-type",
      icon: (
        <img
          src="/assets/classification.png"
          alt="PMS Catalog"
          className="w-7 h-7"
        />
      ),
      label: "PMS Catalog",
      for: ["supply", "admin", "admin_supply"],
    },
    {
      href: "/account",
      icon: <User className="w-7 h-7" />,
      label: "My Account",
      for: ["all"],
    },
    {
      href: "/users",
      icon: <Users className="w-7 h-7" />,
      label: "User Management",
      for: ["admin", "admin_supply"],
    },
    {
      href: "/mobilis-aboutus",
      icon: <Info className="w-7 h-7" />,
      label: "About Us",
      for: ["all"],
    },
  ];

  // Check if the current location matches the item's href for active state
  const isActive = (href: string) => location.pathname === href;

  const [reportsOpen, setReportsOpen] = useState(false);

  return (
    <aside
      className={`w-[${isCollapsed ? "80px" : "260px"}] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden`}
    >
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1 w-12 h-12shadow-lg shadow-blue-200 dark:shadow-none overflow-hidden rounded-xl flex items-center justify-center transition-transform duration-300">
            <img
              src="/assets/inppo_logo.png"
              alt="INPPO Logo"
              className="w-full h-full object-contain image-render-auto"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.parentElement!.innerHTML =
                  '<svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
              }}
            />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="font-bold leading-tight text-slate-900 dark:text-white">
                {profileRole?.includes("supply")
                  ? "Project M.O.B.I.L.I.S"
                  : "Project JOEMAR"}
              </h1>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-black">
                Ilocos Norte PPO
              </p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
        {/* Main menu items */}
        {mainMenuItems
          .filter(
            (item) =>
              !item.for ||
              item.for.includes("all") ||
              item.for.includes(profileRole!),
          )
          .map((item, index) => (
            <SidebarItem
              key={index}
              href={item.href}
              icon={item.icon}
              label={item.label}
              isCollapsed={isCollapsed}
              isActive={isActive(item.href)}
            />
          ))}

        {/* Reports Dropdown */}
        {["admin_supply"].includes(profileRole ?? "") && (
          <div>
            <button
              type="button"
              onClick={() => {
                if (isCollapsed) {
                  // Expand sidebar first
                  toggleSidebar();

                  // Open reports dropdown
                  setReportsOpen(true);
                } else {
                  // Normal dropdown behavior
                  setReportsOpen((prev) => !prev);
                }
              }}
              className={`
                w-full flex items-center gap-3 rounded-xl px-3 py-3
                text-slate-700 dark:text-slate-200
                hover:bg-slate-100 dark:hover:bg-slate-800
                transition-colors
                ${isCollapsed ? "justify-center" : "justify-start"}
              `}
            >
              <img src="/assets/report.png" alt="Reports" className="w-7 h-7" />

              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left font-medium">Reports</span>

                  <ChevronDown
                    className={`h-5 w-5 transition-transform duration-200 ${
                      reportsOpen ? "rotate-180" : ""
                    }`}
                  />
                </>
              )}
            </button>

            {/* Reports submenu */}
            {!isCollapsed && reportsOpen && (
              <div className="ml-2 mt-1 space-y-1 border-l border-slate-200 pl-3 dark:border-slate-700">
                <SidebarItem
                  href="/reports/pms"
                  label="PMS History"
                  isCollapsed={false}
                  isActive={isActive("/reports/pms")}
                />

                <SidebarItem
                  href="/reports/registration-status"
                  label="Mobility Registration Status"
                  isCollapsed={false}
                  isActive={isActive("/reports/registration-status")}
                />

                <SidebarItem
                  href="/reports/insurance-status"
                  label="Mobility Insurance Status"
                  isCollapsed={false}
                  isActive={isActive("/reports/insurance-status")}
                />

                <SidebarItem
                  href="/reports/distribution"
                  label="Mobility Distribution"
                  isCollapsed={false}
                  isActive={isActive("/reports/distribution")}
                />

                <SidebarItem
                  href="/reports/inspection"
                  label="Inspection Results"
                  isCollapsed={false}
                  isActive={isActive("/reports/inspection")}
                />
              </div>
            )}
          </div>
        )}

        <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
          {settingsItems
            .filter(
              (item) =>
                !item.for ||
                item.for.includes("all") ||
                item.for.includes(profileRole!),
            )
            .map((item, index) => (
              <SidebarItem
                key={index}
                href={item.href}
                icon={item.icon}
                label={item.label}
                isCollapsed={isCollapsed}
                isActive={isActive(item.href)}
              />
            ))}
        </div>
      </nav>

      {/* Logout button at the bottom */}
      <div className="mt-auto border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={toggleSidebar}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="w-full flex items-center justify-center gap-2 py-3 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          {/* Chevron icon with rotation animation when collapsed */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`collapse-icon transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>
    </aside>
  );
};
