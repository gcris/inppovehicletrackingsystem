import { motion } from "framer-motion";

type Props = {
  item: any;
};

export default function WorkflowNode({ item }: Props) {
  const Icon = item.icon;

  return (
    <motion.div
      initial={{
        opacity: 0,
        scale: 0.9,
        y: 50,
      }}
      whileInView={{
        opacity: 1,
        scale: 1,
        y: 0,
      }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      whileHover={{ y: -10 }}
      className="relative mt-10 flex h-[430px] w-[320px] justify-center"
    >
      {/* Floating Step Badge */}
      <motion.div
        whileHover={{ scale: 1.1 }}
        className="
          absolute
          -right-5
          -top-5
          z-30
          flex
          h-14
          w-14
          items-center
          justify-center
          rounded-full
          border-4
          border-white
          bg-blue-600
          text-2xl
          font-bold
          text-white
          shadow-xl
        "
      >
        {item.number}
      </motion.div>

      {/* Main Card */}
      <div
        className="
          relative
          h-full
          w-full
          overflow-hidden
          rounded-[32px]
          border
          border-slate-200
          bg-white
          shadow-[0_20px_60px_rgba(15,23,42,.12)]
          dark:border-slate-800
          dark:bg-slate-900
        "
      >
        {/* Decorative Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/40 to-transparent" />

        {/* Floating Icon */}
        <motion.div
          whileHover={{
            rotate: 8,
            scale: 1.08,
          }}
          transition={{
            type: "spring",
            stiffness: 300,
          }}
          className={`
            ${item.color}
            absolute
            left-8
            top-16
            z-20
            flex
            h-24
            w-24
            items-center
            justify-center
            rounded-full
            shadow-2xl
          `}
        >
          <img
            src={item.icon}
            alt={item.title}
            className="h-14 w-14 object-contain"
          />
        </motion.div>

        {/* Floating Content Card */}
        <motion.div
          whileHover={{ y: -5 }}
          className="
            absolute
            left-1/2
            top-40
            z-10
            w-[270px]
            -translate-x-1/2
            rounded-[28px]
            border
            border-slate-200
            bg-white
            p-6
            text-center
            shadow-xl
            dark:border-slate-800
            dark:bg-slate-900
          "
        >
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            {item.title}
          </h3>

          <p className="mt-4 leading-7 text-slate-500">{item.description}</p>
        </motion.div>
      </div>
    </motion.div>
  );
}
