import { readFile, writeFile, readdir, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { nanoid } from "nanoid";
import yaml from "js-yaml";
import type { WatchlistConfig, WatchlistSymbolEntry } from "./types";

function getWatchlistDir(workspacePath?: string): string {
  if (workspacePath) {
    return join(workspacePath, ".viben", "shared", "watchlists");
  }
  const home = process.env.HOME || process.env.USERPROFILE || "~";
  return join(home, ".viben", "shared", "watchlists");
}

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

function configToYaml(config: WatchlistConfig): string {
  return yaml.dump(config, { lineWidth: 120 });
}

function yamlToConfig(content: string, filename: string): WatchlistConfig {
  const data = yaml.load(content) as Record<string, unknown>;
  return {
    id: (data.id as string) || filename.replace(".yaml", ""),
    name: (data.name as string) || "",
    color: (data.color as string) || "#0891B2",
    refresh_interval: (data.refresh_interval as number) || 300,
    refresh_prompt: (data.refresh_prompt as string) || "",
    symbols: (data.symbols as WatchlistSymbolEntry[]) || [],
    column_config: (data.column_config as string[]) || [],
  };
}

export async function listWatchlists(workspacePath?: string): Promise<WatchlistConfig[]> {
  const dir = getWatchlistDir(workspacePath);
  await ensureDir(dir);
  const files = await readdir(dir);
  const yamlFiles = files.filter((f) => f.endsWith(".yaml"));
  const lists: WatchlistConfig[] = [];
  for (const file of yamlFiles) {
    const content = await readFile(join(dir, file), "utf-8");
    lists.push(yamlToConfig(content, file));
  }
  return lists;
}

export async function getWatchlist(listId: string, workspacePath?: string): Promise<WatchlistConfig | null> {
  const dir = getWatchlistDir(workspacePath);
  const filePath = join(dir, `${listId}.yaml`);
  if (!existsSync(filePath)) return null;
  const content = await readFile(filePath, "utf-8");
  return yamlToConfig(content, `${listId}.yaml`);
}

export async function createWatchlist(
  params: { name: string; color?: string; refresh_interval?: number; refresh_prompt?: string },
  workspacePath?: string
): Promise<WatchlistConfig> {
  const dir = getWatchlistDir(workspacePath);
  await ensureDir(dir);
  const id = `wl_${nanoid(8)}`;
  const config: WatchlistConfig = {
    id,
    name: params.name,
    color: params.color || "#0891B2",
    refresh_interval: params.refresh_interval || 300,
    refresh_prompt: params.refresh_prompt || "",
    symbols: [],
    column_config: [],
  };
  await writeFile(join(dir, `${id}.yaml`), configToYaml(config), "utf-8");
  return config;
}

export async function updateWatchlist(
  listId: string,
  updates: Partial<Pick<WatchlistConfig, "name" | "color" | "refresh_interval" | "refresh_prompt" | "column_config">>,
  workspacePath?: string
): Promise<WatchlistConfig | null> {
  const config = await getWatchlist(listId, workspacePath);
  if (!config) return null;
  const updated = { ...config, ...updates };
  const dir = getWatchlistDir(workspacePath);
  await writeFile(join(dir, `${listId}.yaml`), configToYaml(updated), "utf-8");
  return updated;
}

export async function deleteWatchlist(listId: string, workspacePath?: string): Promise<boolean> {
  const dir = getWatchlistDir(workspacePath);
  const filePath = join(dir, `${listId}.yaml`);
  if (!existsSync(filePath)) return false;
  await unlink(filePath);
  return true;
}

export async function addSymbols(
  listId: string,
  symbols: string[],
  workspacePath?: string
): Promise<WatchlistConfig | null> {
  const config = await getWatchlist(listId, workspacePath);
  if (!config) return null;
  const existing = new Set(config.symbols.map((s) => s.symbol));
  const newEntries: WatchlistSymbolEntry[] = symbols
    .filter((s) => !existing.has(s))
    .map((symbol) => ({ symbol, annotation: "", added_at: new Date().toISOString() }));
  config.symbols.push(...newEntries);
  const dir = getWatchlistDir(workspacePath);
  await writeFile(join(dir, `${listId}.yaml`), configToYaml(config), "utf-8");
  return config;
}

export async function removeSymbols(
  listId: string,
  symbols: string[],
  workspacePath?: string
): Promise<WatchlistConfig | null> {
  const config = await getWatchlist(listId, workspacePath);
  if (!config) return null;
  const toRemove = new Set(symbols);
  config.symbols = config.symbols.filter((s) => !toRemove.has(s.symbol));
  const dir = getWatchlistDir(workspacePath);
  await writeFile(join(dir, `${listId}.yaml`), configToYaml(config), "utf-8");
  return config;
}

export async function setAnnotation(
  listId: string,
  symbol: string,
  annotation: string,
  workspacePath?: string
): Promise<boolean> {
  const config = await getWatchlist(listId, workspacePath);
  if (!config) return false;
  const entry = config.symbols.find((s) => s.symbol === symbol);
  if (!entry) return false;
  entry.annotation = annotation;
  const dir = getWatchlistDir(workspacePath);
  await writeFile(join(dir, `${listId}.yaml`), configToYaml(config), "utf-8");
  return true;
}
