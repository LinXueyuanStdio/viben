/**
 * Browse Plugin types for the search source store
 */

export interface BrowsePluginRegistryEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  sources: string[];
  requires_env?: string[];
  category?: string;
  download_url: string;
}

export interface BrowsePluginRegistry {
  version: string;
  plugins: BrowsePluginRegistryEntry[];
}

export interface InstalledBrowsePlugin {
  id: string;
  name: string;
  sources: string[];
  path: string;
  installed_at: string;
}

export interface InstalledBrowsePluginsResponse {
  plugins: InstalledBrowsePlugin[];
  total: number;
}

export interface InstallBrowsePluginResponse {
  success: boolean;
  plugin?: InstalledBrowsePlugin;
  error?: string;
}
