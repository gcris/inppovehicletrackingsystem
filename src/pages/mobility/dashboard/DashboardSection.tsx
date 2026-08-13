import { ReactNode } from "react";

type Props = {
  title: string;

  children: ReactNode;
};

export default function DashboardSection({ title, children }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>

      <div className="p-6">{children}</div>
    </div>
  );
}
