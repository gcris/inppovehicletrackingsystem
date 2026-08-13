import { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
};

export default function SectionTitle({ title, subtitle }: Props) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>

        {subtitle && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
