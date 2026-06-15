import { Link } from "react-router-dom";
import { Database, ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { BentoGrid, BentoCard } from "@/components/layout";
import { useExecutors } from "@/hooks/use-workspace-resources";
import { useAppStore } from "@/stores";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

// Easing curves as const tuples for Framer Motion type compatibility
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

export function DashboardPage() {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const { executors, loading: executorsLoading } = useExecutors();
  const {
    providers,
    getAvailableProviders,
  } = useAppStore();


  // Count configured executors (those with workspace config or supporting MCP)
  const configuredAgents = executors.filter((e) =>
    e.has_workspace_config && e.supports_mcp &&
    (e.availability.type === "LOGIN_DETECTED" || e.availability.type === "INSTALLATION_FOUND")
  );
  const availableProviders = getAvailableProviders();

  // State to track if component has mounted (for animations)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Card entrance animation variants
  const cardVariants = {
    hidden: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : 20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.4,
        ease: easeOutExpo,
      },
    },
  };

  return (
    <div className="p-6">
      {/* Page title - no individual animation, AppLayout handles page transitions */}
      <h1 className="text-2xl font-bold mb-6">{t("dashboard.title")}</h1>

      {/* Main Dashboard Grid - Using Bento Grid with stagger animations */}
      <motion.div
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: prefersReducedMotion ? 0 : 0.08,
              delayChildren: prefersReducedMotion ? 0 : 0.1,
            },
          },
        }}
      >
        <BentoGrid gap="lg">
        {/* Stats Row - Data Sources card */}
        <motion.div variants={cardVariants} className="bento-card-small">
          <BentoCard size="small" className="h-full">
            <Link to="/mcp-services/browse-mcp" className="block h-full -m-6 rounded-lg p-6 transition-colors duration-200 hover:bg-muted/50">
              <StatCardContent
                title={t("dashboard.dataSources")}
                value={`${availableProviders.length}`}
                description={t("dashboard.outOfConfigured", { total: providers.length })}
                icon={Database}
              />
            </Link>
          </BentoCard>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={cardVariants} className="bento-card-small">
          <BentoCard size="small" asCard={false} className="flex flex-col gap-6 h-full">
            <QuickActionCard
              title={t("dashboard.manageDataSources")}
              description={t("dashboard.manageDataSourcesDesc")}
              linkTo="/mcp-services/browse-mcp"
              count={t("dashboard.availableCount", { count: availableProviders.length })}
            />
          </BentoCard>
        </motion.div>

        {/* Environment Status - Full width */}
        <motion.div variants={cardVariants} className="bento-card-full">
          <BentoCard size="full" className="h-full">
            <h2 className="text-lg font-semibold mb-4">{t("dashboard.environmentStatus")}</h2>
            <div className="space-y-3">
              <StatusRow
                label={t("dashboard.configuredAgents")}
                value={executorsLoading ? t("dashboard.detecting") : t("dashboard.agentsCount", { count: configuredAgents.length })}
                ok={configuredAgents.length > 0}
              />
            </div>
          </BentoCard>
        </motion.div>
      </BentoGrid>
      </motion.div>
    </div>
  );
}

interface StatCardContentProps {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  valueClassName?: string;
}

function StatCardContent({
  title,
  value,
  description,
  icon: Icon,
  valueClassName,
}: StatCardContentProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className={`text-2xl font-bold ${valueClassName || ""}`}>{value}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </>
  );
}

interface QuickActionCardProps {
  title: string;
  description: string;
  linkTo: string;
  count: string;
}

function QuickActionCard({ title, description, linkTo, count }: QuickActionCardProps) {
  return (
    <Link
      to={linkTo}
      className="flex flex-1 items-center justify-between rounded-lg border bg-card p-4 transition-colors duration-200 theme-transition hover:bg-muted/50"
    >
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="text-xs text-muted-foreground mt-1">{count}</p>
      </div>
      <ArrowRight className="h-5 w-5 text-muted-foreground" />
    </Link>
  );
}

interface StatusRowProps {
  label: string;
  value: string;
  ok: boolean;
}

function StatusRow({ label, value, ok }: StatusRowProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={ok ? "text-foreground" : "text-muted-foreground"}>
          {value}
        </span>
        <div
          className={`h-2 w-2 rounded-full transition-colors duration-300 ${
            ok ? "bg-green-500" : "bg-muted"
          }`}
        />
      </div>
    </div>
  );
}
