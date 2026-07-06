import { motion } from "framer-motion";
import { SparklesIcon } from "lucide-react";

export const Greeting = () => {
  return (
    <div className="flex flex-col items-center px-6 text-center select-none" key="overview">
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="mb-4 rounded-xl border border-border/50 bg-card/45 p-2.5 text-muted-foreground/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
        initial={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <SparklesIcon className="size-4.5" />
      </motion.div>

      <motion.h1
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
        initial={{ opacity: 0, y: 8 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        What can I help with?
      </motion.h1>

      <motion.p
        animate={{ opacity: 1, y: 0 }}
        className="mt-2.5 max-w-[280px] text-muted-foreground/65 text-[13px] leading-relaxed md:max-w-sm"
        initial={{ opacity: 0, y: 8 }}
        transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        Ask a question, write and analyze code, or brainstorm ideas.
      </motion.p>
    </div>
  );
};

