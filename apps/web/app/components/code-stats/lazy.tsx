"use client";

import dynamic from "next/dynamic";

// All chart components below depend on recharts (~200KB gzipped).
// Lazy-load them with ssr:false so recharts is only downloaded when the
// code-stats page is actually visited.

export const LangChart = dynamic(
  () => import("./lang-chart").then((m) => ({ default: m.LangChart })),
  { ssr: false },
);

export const ModuleChart = dynamic(
  () => import("./module-chart").then((m) => ({ default: m.ModuleChart })),
  { ssr: false },
);

export const CategoryChart = dynamic(
  () => import("./category-chart").then((m) => ({ default: m.CategoryChart })),
  { ssr: false },
);

export const AppsChart = dynamic(
  () => import("./apps-chart").then((m) => ({ default: m.AppsChart })),
  { ssr: false },
);

export const DesktopChart = dynamic(
  () => import("./desktop-chart").then((m) => ({ default: m.DesktopChart })),
  { ssr: false },
);

export const DensityChart = dynamic(
  () => import("./density-chart").then((m) => ({ default: m.DensityChart })),
  { ssr: false },
);

export const CodeFreshnessChart = dynamic(
  () =>
    import("./code-freshness-chart").then((m) => ({
      default: m.CodeFreshnessChart,
    })),
  { ssr: false },
);

export const FileSizeChart = dynamic(
  () =>
    import("./file-size-chart").then((m) => ({ default: m.FileSizeChart })),
  { ssr: false },
);

export const FileChurnChart = dynamic(
  () =>
    import("./file-churn-chart").then((m) => ({ default: m.FileChurnChart })),
  { ssr: false },
);
