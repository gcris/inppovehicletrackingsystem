import { motion } from "framer-motion";
import { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
  value: string;
  delay?: number;
  className?: string;
};

export default function FloatingCard({
  icon,
  title,
  value,
  delay = 0,
  className = "",
}: Props) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        scale: 0.8,
        y: 30,
      }}
      whileInView={{
        opacity: 1,
        scale: 1,
        y: 0,
      }}
      viewport={{
        once: true,
        amount: 0.4,
      }}
      className={`
        absolute
        rounded-2xl
        border
        border-slate-200
        bg-white/90
        backdrop-blur-xl
        px-5
        py-4
        shadow-xl

        dark:border-slate-800
        dark:bg-slate-900/90

        ${className}
        `}
    >
      <motion.div
        animate={{
          y: [0, -10, 0],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
          delay,
        }}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/30">
            {icon}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {title}
            </p>
            <p className="font-bold">{value}</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
