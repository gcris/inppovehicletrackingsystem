import { motion } from "framer-motion";
import BrowserFrame from "./BrowserFrame";
import FloatingCard from "../FloatingCard";
import { Car, ClipboardCheck, ShieldCheck, Wrench } from "lucide-react";

type Props = {
  title: string;
  description: string;
  image: string;
  reverse?: boolean;
};

export default function ShowcaseCard({
  title,
  description,
  image,
  reverse,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7 }}
      className={`grid items-center gap-16 lg:grid-cols-2 ${
        reverse ? "lg:[&>*:first-child]:order-2" : ""
      }`}
    >
      <div>
        <h2 className="text-4xl font-black">{title}</h2>

        <p className="mt-6 text-lg leading-8 text-slate-500">{description}</p>
      </div>

      {/* <FloatingCard
        className="left-14 top-8"
        title="Mobility"
        value="Centralized Maintenance"
        icon={<Car size={18} />}
        delay={0}
      />

      <FloatingCard
        className="right-10 top-20"
        title="Inspection"
        value="Digital Mobility Inspection and Evaluation"
        icon={<ClipboardCheck size={18} />}
        delay={1}
      />

      <FloatingCard
        className="left-8 bottom-16"
        title="Maintenance"
        value="Reminder for Mobility Assets Maintenance Schedule"
        icon={<Wrench size={18} />}
        delay={2}
      />

      <FloatingCard
        className="right-12 bottom-10"
        title="Mobility Status"
        value="Checks the mobility condition"
        icon={<ShieldCheck size={18} />}
        delay={3}
      /> */}

      <BrowserFrame image={image} title={title} />
    </motion.div>
  );
}
