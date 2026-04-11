// Release data types

export type Platform = 'macos' | 'windows' | 'linux' | 'unknown';

export interface DesktopAsset {
  url: string;
  name: string;
}

export interface DesktopReleaseAssets {
  macos: {
    arm64: DesktopAsset;  // Apple Silicon (M1/M2/M3)
    x64: DesktopAsset;    // Intel
  };
  windows: {
    msi: DesktopAsset;
    exe: DesktopAsset;
  };
  linux: {
    appimage: DesktopAsset;
    deb: DesktopAsset;
  };
}

export interface DesktopRelease {
  version: string;
  tag: string;
  date: string;
  repository: string;
  assets: DesktopReleaseAssets;
}

export interface InstallMethod {
  command: string;
  platforms: Platform[];
}

export interface CLIReleaseAssets {
  install_sh: {
    url: string;
    name: string;
  };
}

export interface CLIRelease {
  version: string;
  tag: string;
  date: string;
  repository: string;
  install_methods: {
    shell: InstallMethod;
    npx: InstallMethod;
    npm: InstallMethod;
    homebrew: InstallMethod;
  };
  assets: CLIReleaseAssets;
  links: {
    npm: string;
    documentation: string;
  };
}

export interface PlatformDownload {
  label: string;
  platform: Platform;
  icon: 'apple' | 'windows' | 'linux';
  downloads: {
    label: string;
    url: string;
    filename: string;
  }[];
}
