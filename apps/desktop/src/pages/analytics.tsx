import { BarChart3, Construction } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";

// Easing curves
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

export function AnalyticsPage() {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();

  // Animation variants for staggered entrance
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.1,
        delayChildren: prefersReducedMotion ? 0 : 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.3,
        ease: easeOutExpo,
      },
    },
  };

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
          {t("creator.analyticsDescription")}
        </p>
      </motion.div>

      <motion.div
        className="rounded-xl border bg-card p-8 text-center"
        variants={itemVariants}
      >
        <Construction className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">{t("common.comingSoon")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("creator.analyticsComingSoonDesc")}
        </p>
      </motion.div>
    </motion.div>
  );
}
