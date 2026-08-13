import {
  Car,
  UserCheck,
  ClipboardCheck,
  Wrench,
  ShieldCheck,
  MapPinned,
  BarChart3,
  ArrowRight,
} from "lucide-react";

import WorkflowCard from "./WorkflowCard";
import WorkflowConnector from "./WorkflowConnector";

const workflow = [
  {
    title: "Mobility Asset",
    description:
      "Register vehicles with complete identity, registration, insurance and assigned unit.",
    icon: "/",
  },
  {
    title: "Driver Assignment",
    description:
      "Assign designated and alternate drivers responsible for each mobility asset.",
    icon: "/",
  },
  {
    title: "Mobility Inspection",
    description:
      "Conduct digital pre-operation inspections using standardized checklists.",
    icon: "/",
  },
  {
    title: "Maintenance",
    description:
      "Monitor preventive maintenance schedules, repairs and service history.",
    icon: "/",
  },
  {
    title: "Ready for Deployment",
    description:
      "Mobility meeting operational requirements become available for deployment.",
    icon: "/",
  },
  {
    title: "Reports & Analytics",
    description:
      "Generate dashboards and analytical reports for informed decision-making.",
    icon: "/",
  },
];

export default function WorkflowSection() {
  return (
    <section className="bg-white py-28 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <p className="font-semibold uppercase tracking-[0.3em] text-blue-600">
            Workflow
          </p>

          <h2 className="mt-4 text-4xl font-black">Mobility Asset Lifecycle</h2>

          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-500">
            Every mobility asset follows a standardized operational
            workflow—from registration and inspection to deployment, patrol
            operations, and reporting.
          </p>
        </div>

        <div className="flex flex-col items-center gap-6 xl:flex-row">
          {workflow.map((item, index) => (
            <div
              key={item.title}
              className="flex w-full items-center xl:w-auto"
            >
              <div className="flex-1">
                <WorkflowCard
                  title={item.title}
                  description={item.description}
                  icon={item.icon}
                />
              </div>

              {index < workflow.length - 1 && (
                <div className="hidden px-4 xl:block">
                  <WorkflowConnector />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
