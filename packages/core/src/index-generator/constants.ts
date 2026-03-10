/**
 * Constants for Index Generator
 */

/** Directories to skip during code search */
export const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  '__pycache__',
  '.venv',
  'venv',
  '.pytest_cache',
  '.mypy_cache',
  'coverage',
  '.idea',
  '.vscode',
  'target',
  'vendor',
  '.auto-claude',
  '.viben',
]);

/** File extensions to search for code files */
export const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.go',
  '.rs',
  '.rb',
  '.php',
]);

/** File extensions for documentation */
export const DOC_EXTENSIONS = new Set(['.md', '.mdx']);

/** Entry file patterns */
export const ENTRY_FILE_PATTERNS = [
  /^index\.(ts|tsx|js|jsx)$/,
  /^main\.(ts|tsx|js|jsx|py)$/,
  /^app\.(ts|tsx|js|jsx)$/,
  /^mod\.rs$/,
];

/** Config file patterns */
export const CONFIG_FILE_PATTERNS = [
  /\.config\.(ts|js|mjs|cjs)$/,
  /^config\//,
  /^tsconfig.*\.json$/,
  /^package\.json$/,
  /^pyproject\.toml$/,
  /^Cargo\.toml$/,
];

/** AI enhancement threshold score */
export const AI_THRESHOLD = 50;

/** Maximum files for AI enhancement */
export const MAX_AI_FILES = 20;

/** Maximum content preview length for AI */
export const MAX_CONTENT_PREVIEW = 2000;

/** Document categories with descriptions */
export const DOC_CATEGORIES: Record<string, string> = {
  'specs/frontend': '前端规范',
  'specs/backend': '后端规范',
  'specs/modules': '模块规范',
  'specs/guides': '开发指南',
  'specs/deployment': '部署文档',
  'specs/roadmap': '路线图',
  'specs/shared': '共享规范',
  plans: '设计文档',
  work: '工作文档',
  'design-system': '设计系统',
};

/** Technology detection patterns */
export const TECH_DETECTION = {
  languages: {
    TypeScript: [/\.tsx?$/, /tsconfig.*\.json$/],
    JavaScript: [/\.jsx?$/, /\.mjs$/, /\.cjs$/],
    Python: [/\.py$/, /pyproject\.toml$/, /requirements\.txt$/],
    Go: [/\.go$/, /go\.mod$/],
    Rust: [/\.rs$/, /Cargo\.toml$/],
  },
  frameworks: {
    React: [/react/, /@types\/react/],
    'Next.js': [/next/, /next\.config/],
    Vue: [/vue/, /\.vue$/],
    Tauri: [/tauri/, /tauri\.conf\.json$/],
    FastAPI: [/fastapi/],
    Express: [/express/],
    Hono: [/hono/],
  },
  buildTools: {
    pnpm: [/pnpm-workspace\.yaml$/, /pnpm-lock\.yaml$/],
    npm: [/package-lock\.json$/],
    yarn: [/yarn\.lock$/],
    Turborepo: [/turbo\.json$/],
    Vite: [/vite\.config/],
    webpack: [/webpack\.config/],
  },
};
