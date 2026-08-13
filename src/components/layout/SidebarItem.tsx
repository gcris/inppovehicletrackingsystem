import { NavLink } from 'react-router-dom';

interface SidebarItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  isCollapsed: boolean;
  isActive?: boolean;
}

/**
 * Sidebar item component
 * - When sidebar is collapsed: shows only the icon with a tooltip (via title attribute) showing the label
 * - When sidebar is expanded: shows icon and label
 * - Active state is determined by the current route or the isActive prop
 */
export const SidebarItem = ({ href, icon, label, isCollapsed, isActive = false }: SidebarItemProps) => {
  // We'll use the NavLink's isActive property to determine if the item is active
  // We'll combine it with the isActive prop (if passed) for flexibility, but primarily rely on NavLink
  return (
    <NavLink
      to={href}
      className={({ isActive: navLinkIsActive }) => {
        const active = navLinkIsActive || isActive;
        return `
          flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all duration-200
          ${active
            ? 'font-bold bg-blue-600 text-white shadow-lg shadow-blue-100 dark:shadow-none'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
          }
        `;
      }}
    >
      {({ isActive: navLinkIsActive }) => {
        const active = navLinkIsActive || isActive;
        return (
          <>
            {/* Icon container */}
            <div
              className={`${active
                ? 'text-white'
                : 'bg-slate-50 dark:bg-slate-800 dark:text-slate-500 rounded-lg p-0.5'
              } transition-colors duration-200 flex items-center justify-center`}
              // When collapsed, we want to show the tooltip. We'll set the title attribute to the label.
              // Note: the title attribute is shown on hover and is accessible.
              title={isCollapsed ? label : undefined}
            >
              {icon}
            </div>

            {/* Label - only show when not collapsed */}
            {!isCollapsed && (
              <span className="text-md tracking-tight">{label}</span>
            )}

            {/* Active indicator (dot) - only show when not collapsed */}
            {active && !isCollapsed && (
              <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full ring-4 ring-blue-400/50"></div>
            )}
          </>
        );
      }}
    </NavLink>
  );
};