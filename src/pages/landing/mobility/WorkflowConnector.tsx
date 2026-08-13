import { motion } from "framer-motion";

export default function WorkflowConnector() {
  return (
    <div className="hidden xl:flex items-center px-4">
      {/* Left Dot */}
      <motion.div
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        transition={{ duration: 0.4 }}
        className="h-3 w-3 rounded-full bg-blue-600"
      />

      {/* Animated Line */}
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: 80 }}
        transition={{
          duration: 0.8,
          delay: 0.2,
        }}
        className="h-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full"
      />

      {/* Right Dot */}
      <motion.div
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        transition={{
          duration: 0.4,
          delay: 0.8,
        }}
        className="h-3 w-3 rounded-full bg-cyan-500"
      />
    </div>
  );
}
