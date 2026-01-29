import { motion } from "framer-motion";

export const Greeting = () => {
  return (
    <div
      className="flex flex-col items-center justify-center p-4 w-full"
      key="overview"
    >
      <motion.h1
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl md:text-5xl font-bold tracking-tight text-center mb-8 md:mb-12"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5 }}
      >
        What can I help with?
      </motion.h1>
    </div>
  );
};
