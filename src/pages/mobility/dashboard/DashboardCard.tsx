import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function DashboardCard({ children }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {children}
    </div>
  );
}
