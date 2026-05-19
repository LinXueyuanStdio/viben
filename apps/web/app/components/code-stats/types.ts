export interface CodeStatsData {
  generatedAt: string;
  summary: {
    totalLines: number;
    totalFiles: number;
    totalModules: number;
    codeLines: number;
    docLines: number;
    configLines: number;
  };
  languages: LanguageStat[];
  modules: ModuleStat[];
  desktopDirs: DirStat[];
  apps: AppStat[];
  density: DensityStat[];
  categories: CategoryStat[];
  topFiles: FileStat[];
  commitActivity?: CommitActivity[];
  fileChurn?: FileChurn[];
  codeFreshness?: FreshnessStat[];
  fileSizeDistribution?: SizeDistribution[];
  architecture?: ArchitectureData;
}

export interface ArchitectureData {
  nodes: ArchNode[];
  edges: ArchEdge[];
  layers: string[];
}

export interface ArchNode {
  id: string;
  label: string;
  lines: number;
  files: number;
  color: string;
  layer: string;
}

export interface ArchEdge {
  from: string;
  to: string;
}

export interface LanguageStat {
  lang: string;
  ext: string;
  lines: number;
  files: number;
  color: string;
}

export interface ModuleStat {
  name: string;
  lines: number;
  files: number;
  color: string;
}

export interface DirStat {
  name: string;
  lines: number;
  files: number;
  color: string;
}

export interface AppStat {
  name: string;
  lines: number;
  files: number;
  color: string;
}

export interface DensityStat {
  name: string;
  density: number;
  color: string;
}

export interface CategoryStat {
  label: string;
  lines: number;
  color: string;
}

export interface FileStat {
  path: string;
  lines: number;
  ext: string;
}

export interface CommitActivity {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface FileChurn {
  path: string;
  changes: number;
  lastChanged: string;
}

export interface FreshnessStat {
  label: string;
  files: number;
  lines: number;
  color: string;
}

export interface SizeDistribution {
  range: string;
  files: number;
  color: string;
}
