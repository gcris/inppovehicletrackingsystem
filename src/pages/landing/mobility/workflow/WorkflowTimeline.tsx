import { motion } from "framer-motion";
import { workflow } from "./workflowData";
import WorkflowNode from "./WorkflowNode";

export default function WorkflowTimeline() {
  return (
    <section
      id="workflow"
      className="relative overflow-hidden bg-slate-50 py-28 dark:bg-slate-950"
    >
      {/* Background */}

      <div className="absolute inset-0 opacity-30">
        <div className="absolute left-0 top-0 h-full w-full bg-[radial-gradient(circle_at_center,#2563eb10_1px,transparent_1px)] [background-size:40px_40px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Title */}

        <motion.div
          initial={{
            opacity: 0,
            y: 40,
          }}
          whileInView={{
            opacity: 1,
            y: 0,
          }}
          viewport={{
            once: true,
          }}
          className="mb-24 text-center"
        >
          <p className="font-semibold uppercase tracking-[0.35em] text-blue-600">
            System Workflow
          </p>

          <h2 className="mt-4 text-5xl font-black">Mobility Asset Lifecycle</h2>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-500">
            Project M.O.B.I.L.I.S streamlines the complete lifecycle of every
            mobility asset—from registration to patrol operations and reporting.
          </p>
        </motion.div>

        {/* Timeline */}

        <div className="relative">
          {/* Center Line */}

          <div className="absolute left-1/2 top-0 hidden h-full -translate-x-1/2 xl:block">
            <motion.div
              initial={{
                height: 0,
              }}
              whileInView={{
                height: "100%",
              }}
              transition={{
                duration: 2,
              }}
              viewport={{
                once: true,
              }}
              className="w-1 rounded-full bg-gradient-to-b from-blue-600 via-cyan-500 to-indigo-600"
            />
          </div>

          {/* Nodes */}

          <div className="space-y-24">
            {workflow.map((item, index) => {
              const left = index % 2 === 0;

              return (
                <div
                  key={item.number}
                  className="relative grid items-center xl:grid-cols-2"
                >
                  {/* LEFT */}

                  <div
                    className={`${
                      left ? "flex justify-end pr-20" : "hidden xl:block"
                    }`}
                  >
                    {left && <WorkflowNode item={item} />}
                  </div>

                  {/* CENTER DOT */}

                  <div
                    className="
                    absolute
                    left-1/2
                    top-1/2
                    hidden
                    -translate-x-1/2
                    -translate-y-1/2
                    xl:flex
                    "
                  >
                    <motion.div
                      whileInView={{
                        scale: [0, 1.3, 1],
                      }}
                      transition={{
                        duration: 0.6,
                      }}
                      className="
                      h-8
                      w-8
                      rounded-full
                      border-4
                      border-white
                      bg-blue-600
                      shadow-xl
                      "
                    />
                  </div>

                  {/* RIGHT */}

                  <div
                    className={`${
                      !left ? "flex justify-start pl-20" : "hidden xl:block"
                    }`}
                  >
                    {!left && <WorkflowNode item={item} />}
                  </div>

                  {/* MOBILE */}

                  <div className="xl:hidden">
                    <WorkflowNode item={item} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
