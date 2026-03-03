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
