import { ReactNode } from "react";
import { motion } from "framer-motion";

type WorkflowCardProps = {
  icon: string;
  title: string;
  description: string;
};

export default function WorkflowCard({
  icon,
  title,
  description,
}: WorkflowCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -8 }}
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-500 hover:-translate-y-3 hover:border-blue-500 hover:shadow-2xl dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Glow Effect */}
      <div className="absolute right-0 top-0 h-36 w-36 translate-x-10 -translate-y-10 rounded-full bg-blue-100 opacity-0 blur-3xl transition-all duration-500 group-hover:opacity-100 dark:bg-blue-900/30" />

      {/* Animated Icon */}
      <motion.div
        whileHover={{
          rotate: 8,
          scale: 1.1,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
        }}
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-900/30"
      >
        <img src={icon} alt={title} className="h-10 w-10 object-contain" />
      </motion.div>

      <h3 className="mb-3 text-lg font-bold">{title}</h3>

      <p className="text-sm leading-7 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </motion.div>
  );
}
