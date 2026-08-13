import { motion } from "framer-motion";

type Props = {
  image: string;
  title: string;
};

export default function BrowserFrame({ image, title }: Props) {
  return (
    <motion.div
      whileHover={{
        y: -12,
        scale: 1.03,
      }}
      transition={{
        type: "spring",
        stiffness: 200,
      }}
      className="group relative perspective-[1200px]"
    >
      {/* Glow */}

      <div
        className="
          absolute
          -inset-4
          rounded-[32px]
          bg-blue-500/20
          blur-3xl
          opacity-0
          transition-all
          duration-500
          group-hover:opacity-100
          "
      />

      {/* Browser */}

      <div
        className="
          relative
          overflow-hidden
          rounded-[28px]
          border
          border-slate-200
          bg-white
          shadow-2xl

          dark:border-slate-800
          dark:bg-slate-900
          "
      >
        {/* Browser Header */}

        <div
          className="
            flex
            items-center
            justify-between
            border-b
            border-slate-200
            bg-slate-100
            px-5
            py-3

            dark:border-slate-800
            dark:bg-slate-800
            "
        >
          <div className="flex gap-2">
            <div className="h-3 w-3 rounded-full bg-red-400" />

            <div className="h-3 w-3 rounded-full bg-yellow-400" />

            <div className="h-3 w-3 rounded-full bg-green-400" />
          </div>

          <div
            className="
              rounded-full
              bg-white
              px-6
              py-1
              text-xs
              text-slate-500

              dark:bg-slate-900
              "
          >
            {title}
          </div>

          <div className="w-16" />
        </div>

        {/* Screenshot */}

        <div className="relative overflow-hidden">
          <img
            src={image}
            alt={title}
            className="
              w-full
              transition-transform
              duration-700
              group-hover:scale-105
              "
          />

          {/* Reflection */}

          <div
            className="
              pointer-events-none
              absolute
              inset-0
              bg-gradient-to-br
              from-white/10
              via-transparent
              to-transparent
              "
          />
        </div>
      </div>
    </motion.div>
  );
}
