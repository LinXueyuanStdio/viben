import { BarChart3, Construction } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

// Animation variants for staggered entrance
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

export function AnalyticsPage() {
  const { t } = useTranslation();

  return (
    <motion.div
      className="p-6 max-w-2xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div className="text-center mb-8" variants={itemVariants}>
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
            <BarChart3 className="h-8 w-8" />
          </div>
        </div>
        <h1 className="text-2xl font-bold">{t("creator.analytics")}</h1>
        <p className="text-muted-foreground mt-2">
          Track downloads and usage statistics for your packages
        </p>
      </motion.div>

      <motion.div
        className="rounded-xl border bg-card p-8 text-center"
        variants={itemVariants}
      >
        <Construction className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">Coming Soon</h2>
        <p className="text-muted-foreground text-sm">
          Analytics dashboard is currently under development. You will be able to
          view download statistics and usage metrics for your packages here.
        </p>
      </motion.div>
    </motion.div>
  );
}
