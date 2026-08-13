import { motion } from "framer-motion";

const executiveLeadership1 = {
  name: "PCOL JOEMAR Q LABIANO",
  position: "Provincial Director/Project Supervisor",
  image: "/team/pd.png",
};

const executiveLeadership2 = [
  {
    name: "PLTCOL PAUL BENEDICT R PARADO",
    position:
      "Deputy Provincial Director for Administration/Assistant Project Supervisor",
    image: "/team/dpda.png",
  },
  {
    name: "PLTCOL JESSIE D BALINANG",
    position:
      "Deputy Provincial Director for Operations/Assistant Project Supervisor",
    image: "/team/dpdo.png",
  },
];

const projectManagement = [
  {
    name: "PLTCOL JEPHRE S TACCAD",
    position:
      "Chief, Provincial Operations and Management Unit/Project Manager",
    description: `Provides direct management and operational oversight for
      Project MOBILIS, ensuring successful planning,
      implementation, coordination, and continuous improvement of
      the system.`,
    image: "/team/c-pomu.png",
  },
  {
    name: "PLT MARIBEL D BARROGA",
    position: "PARMU-Supply/Finance Officer/Assistant Project Manager",
    description: null,
    image: "/team/supply-officer.png",
  },
];

const developmentTeam = [
  {
    name: "PMSg Jefferson R Ulep",
    position: "Project Team Leader/C, LES PNCO",
    image: "/team/pmsg-ulep.png",
  },
  {
    name: "Pat Gerry Cris M Cariaga",
    position: "System Developer/Asst. LES PNCO",
    image: "/team/pat-cariaga.png",
  },
];

export default function TeamSection() {
  // const provincialDirector = executiveLeadership.find(
  //   (x) => x.position === "Provincial Director",
  // );

  return (
    <section
      id="team"
      className="relative overflow-hidden bg-slate-50 py-32 dark:bg-slate-950"
    >
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}

        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
            Meet the Team
          </span>

          <h2 className="mt-4 text-5xl font-bold text-slate-900">
            The People Behind
            <span className="block text-blue-600">Project MOBILIS</span>
          </h2>

          <p className="mt-6 text-lg leading-8 text-slate-600">
            Dedicated individuals committed to transforming mobility asset
            management through innovation, collaboration, and digital
            transformation.
          </p>
        </motion.div>

        {/* Featured Member */}

        <div className="mt-12 grid gap-8 lg:grid-cols-1">
          {executiveLeadership1 && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mx-auto mt-20 max-w-5xl"
            >
              <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white shadow-xl dark:bg-slate-950">
                <div className="grid items-center gap-10 p-10 lg:grid-cols-[280px_1fr]">
                  <div className="flex justify-center">
                    <img
                      src={executiveLeadership1.image}
                      alt={executiveLeadership1.name}
                      className="h-56 w-56 rounded-full object-cover border-4 border-blue-100 shrink-0 bg-gradient-to-b from-blue-500 via-slate-800 to-slate-900"
                    />
                  </div>

                  <div>
                    <h3 className="mt-5 text-4xl font-bold text-slate-900">
                      {executiveLeadership1.name}
                    </h3>

                    <p className="mt-2 text-xl font-semibold text-blue-600">
                      {executiveLeadership1.position}
                    </p>

                    <p className="mt-6 leading-8 text-slate-600 dark:text-white">
                      Provides executive leadership, strategic guidance, and
                      overall oversight for Project MOBILIS, ensuring that the
                      system aligns with the operational objectives and digital
                      transformation initiatives of the Ilocos Norte Police
                      Provincial Office.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {executiveLeadership2
            .filter((x) => x.position !== "Provincial Director")
            .map((leader) => (
              <motion.div
                key={leader.name}
                whileHover={{ y: -6 }}
                className="rounded-3xl border border-slate-200 bg-white dark:bg-slate-950 p-8 shadow-lg transition-all"
              >
                <div className="flex flex-col items-center text-center">
                  <img
                    src={leader.image}
                    alt={leader.name}
                    className="h-48 w-48 rounded-full border-4 border-blue-100 object-cover shrink-0 bg-gradient-to-b from-blue-500 via-slate-800 to-slate-900"
                  />

                  <p className="mt-6 text-3xl font-bold text-slate-900 dark:text-white">
                    {leader.name}
                  </p>

                  <p className="mt-2 text-lg font-semibold text-blue-600">
                    {leader.position}
                  </p>
                </div>
              </motion.div>
            ))}
        </div>

        <div className="mx-auto mt-16 max-w-4xl">
          {projectManagement.map((manager) => (
            <motion.div
              key={manager.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -6 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mt-10 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white shadow-xl dark:bg-slate-950"
            >
              <div className="grid items-center gap-10 p-10 lg:grid-cols-[220px_1fr]">
                <div className="flex justify-center">
                  <img
                    src={manager.image}
                    alt={manager.name}
                    className="h-42 w-42 rounded-full border-4 border-blue-100 object-cover shrink-0 bg-gradient-to-b from-blue-500 via-slate-800 to-slate-900"
                  />
                </div>

                <div>
                  <p className="mt-5 text-3xl font-bold text-slate-900 dark:text-white">
                    {manager.name}
                  </p>

                  <p className="mt-2 text-lg font-semibold text-blue-600">
                    {manager.position}
                  </p>

                  {manager.description && (
                    <p className="mt-6 leading-8 text-slate-600 dark:text-white">
                      {manager.description}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Other Members */}

        <div className="mt-16 flex flex-wrap justify-center gap-8">
          {developmentTeam.map((member) => (
            <motion.div
              key={member.name + member.position}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -6 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white shadow-xl dark:bg-slate-950 md:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.333rem)]"
            >
              <div className="items-center gap-10 p-5">
                <div className="flex justify-center">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="h-32 w-32 rounded-full border-4 border-blue-100 object-cover object-[center_20%] shrink-0 bg-gradient-to-b from-blue-500 via-slate-800 to-slate-900"
                  />
                </div>

                <h4 className="mt-6 text-center text-xl font-semibold text-slate-900">
                  {member.name}
                </h4>

                <p className="mt-2 text-center text-lg font-semibold text-blue-600">
                  {member.position}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
