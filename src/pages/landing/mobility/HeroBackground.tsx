import { motion } from "framer-motion";

export default function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Blueprint Grid */}

      <motion.div
        animate={{
          backgroundPosition: ["0px 0px", "60px 60px"],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
        className="
absolute
inset-0
opacity-20
"
        style={{
          backgroundImage: `
            linear-gradient(to right,#3b82f610 1px,transparent 1px),
            linear-gradient(to bottom,#3b82f610 1px,transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Radial Fade */}

      <div
        className="
absolute
inset-0
bg-[radial-gradient(circle_at_center,transparent_35%,white)]
dark:bg-[radial-gradient(circle_at_center,transparent_30%,#020617)]
"
      />

      {/* Left Glow */}

      <motion.div
        animate={{
          x: [0, 40, 0],
          y: [0, -30, 0],
        }}
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="
absolute
-left-32
top-24
h-[450px]
w-[450px]
rounded-full
bg-blue-500/20
blur-[120px]
"
      />

      {/* Right Glow */}

      <motion.div
        animate={{
          x: [0, -60, 0],
          y: [0, 40, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="
          absolute
          -right-32
          bottom-10
          h-[420px]
          w-[420px]
          rounded-full
          bg-cyan-500/20
          blur-[120px]
          "
      />

      {Array.from({ length: 25 }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -25, 0],
            opacity: [0.2, 1, 0.2],
          }}
          transition={{
            duration: 3 + (i % 4),
            repeat: Infinity,
            delay: i * 0.25,
          }}
          className="absolute rounded-full bg-blue-400/40"
          style={{
            width: 4,
            height: 4,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
        />
      ))}
    </div>
  );
}
