/**
 * App Installer Tests
 *
 * Tests for pure functions in app-installer module.
 * Focus on functions that don't require mocking external systems.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  detectAppPlatform,
  isPlatformSupported,
  getPlatformDisplayName,
  getAssetForPlatform,
  formatBytes,
  getDefaultDownloadDir,
  getManualInstallCommand,
} from "./app-installer";
import type { ReleaseInfo, SupportedPlatform, UnsupportedPlatform } from "./app-installer";
import { homedir } from "node:os";
import { join } from "node:path";

// ============================================================================
// detectAppPlatform
// ============================================================================

describe("detectAppPlatform", () => {
  let originalPlatform: PropertyDescriptor | undefined;
  let originalArch: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    originalArch = Object.getOwnPropertyDescriptor(process, "arch");
  });

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(process, "platform", originalPlatform);
    }
    if (originalArch) {
      Object.defineProperty(process, "arch", originalArch);
    }
  });

  it("should detect darwin-arm64", () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    Object.defineProperty(process, "arch", { value: "arm64", configurable: true });

    expect(detectAppPlatform()).toBe("darwin-arm64");
  });

  it("should detect darwin-x64", () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    Object.defineProperty(process, "arch", { value: "x64", configurable: true });

    expect(detectAppPlatform()).toBe("darwin-x64");
  });

  it("should detect win32-x64", () => {
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    Object.defineProperty(process, "arch", { value: "x64", configurable: true });

    expect(detectAppPlatform()).toBe("win32-x64");
  });

  it("should detect win32-arm64 as unsupported platform", () => {
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    Object.defineProperty(process, "arch", { value: "arm64", configurable: true });

    expect(detectAppPlatform()).toBe("win32-arm64");
  });

  it("should detect linux-x64", () => {
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    Object.defineProperty(process, "arch", { value: "x64", configurable: true });

    expect(detectAppPlatform()).toBe("linux-x64");
  });

  it("should detect linux-arm64 as unsupported platform", () => {
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    Object.defineProperty(process, "arch", { value: "arm64", configurable: true });

    expect(detectAppPlatform()).toBe("linux-arm64");
  });

  it("should default to linux-x64 for unknown platforms", () => {
    Object.defineProperty(process, "platform", { value: "freebsd", configurable: true });
    Object.defineProperty(process, "arch", { value: "x64", configurable: true });

    expect(detectAppPlatform()).toBe("linux-x64");
  });
});

// ============================================================================
// isPlatformSupported
// ============================================================================

describe("isPlatformSupported", () => {
  describe("supported platforms", () => {
    it("should return true for darwin-arm64", () => {
      expect(isPlatformSupported("darwin-arm64")).toBe(true);
    });

    it("should return true for darwin-x64", () => {
      expect(isPlatformSupported("darwin-x64")).toBe(true);
    });

    it("should return true for win32-x64", () => {
      expect(isPlatformSupported("win32-x64")).toBe(true);
    });

    it("should return true for linux-x64", () => {
      expect(isPlatformSupported("linux-x64")).toBe(true);
    });
  });

  describe("unsupported platforms", () => {
    it("should return false for win32-arm64", () => {
      expect(isPlatformSupported("win32-arm64")).toBe(false);
    });

    it("should return false for linux-arm64", () => {
      expect(isPlatformSupported("linux-arm64")).toBe(false);
    });

    it("should return false for unknown platform strings", () => {
      expect(isPlatformSupported("freebsd-x64")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isPlatformSupported("")).toBe(false);
    });
  });
});

// ============================================================================
// getPlatformDisplayName
// ============================================================================

describe("getPlatformDisplayName", () => {
  it("should return 'macOS (Apple Silicon)' for darwin-arm64", () => {
    expect(getPlatformDisplayName("darwin-arm64")).toBe("macOS (Apple Silicon)");
  });

  it("should return 'macOS (Intel)' for darwin-x64", () => {
    expect(getPlatformDisplayName("darwin-x64")).toBe("macOS (Intel)");
  });

  it("should return 'Windows (x64)' for win32-x64", () => {
    expect(getPlatformDisplayName("win32-x64")).toBe("Windows (x64)");
  });

  it("should return 'Windows (ARM64)' for win32-arm64", () => {
    expect(getPlatformDisplayName("win32-arm64")).toBe("Windows (ARM64)");
  });

  it("should return 'Linux (x64)' for linux-x64", () => {
    expect(getPlatformDisplayName("linux-x64")).toBe("Linux (x64)");
  });

  it("should return 'Linux (ARM64)' for linux-arm64", () => {
    expect(getPlatformDisplayName("linux-arm64")).toBe("Linux (ARM64)");
  });

  it("should return platform string as fallback for unknown platforms", () => {
    // Type casting to test fallback behavior
    const unknownPlatform = "unknown-platform" as SupportedPlatform;
    expect(getPlatformDisplayName(unknownPlatform)).toBe("unknown-platform");
  });
});

// ============================================================================
// getAssetForPlatform
// ============================================================================

describe("getAssetForPlatform", () => {
  const mockReleaseInfo: ReleaseInfo = {
    version: "1.0.0",
    tag: "v1.0.0",
    date: "2024-01-01",
    desktop: {
      assets: {
        macos: {
          arm64: { url: "https://example.com/viben-arm64.dmg", name: "Viben_1.0.0_aarch64.dmg", size: 100000 },
          x64: { url: "https://example.com/viben-x64.dmg", name: "Viben_1.0.0_x64.dmg", size: 110000 },
        },
        windows: {
          exe: { url: "https://example.com/viben-setup.exe", name: "Viben_1.0.0_x64-setup.exe", size: 80000 },
          msi: { url: "https://example.com/viben.msi", name: "Viben_1.0.0_x64.msi", size: 85000 },
        },
        linux: {
          deb: { url: "https://example.com/viben.deb", name: "Viben_1.0.0_amd64.deb", size: 70000 },
        },
      },
    },
  };

  describe("macOS platforms", () => {
    it("should return arm64 DMG for darwin-arm64", () => {
      const asset = getAssetForPlatform(mockReleaseInfo, "darwin-arm64");

      expect(asset.url).toBe("https://example.com/viben-arm64.dmg");
      expect(asset.name).toBe("Viben_1.0.0_aarch64.dmg");
      expect(asset.size).toBe(100000);
    });

    it("should return x64 DMG for darwin-x64", () => {
      const asset = getAssetForPlatform(mockReleaseInfo, "darwin-x64");

      expect(asset.url).toBe("https://example.com/viben-x64.dmg");
      expect(asset.name).toBe("Viben_1.0.0_x64.dmg");
      expect(asset.size).toBe(110000);
    });
  });

  describe("Windows platforms", () => {
    it("should return EXE by default for win32-x64", () => {
      const asset = getAssetForPlatform(mockReleaseInfo, "win32-x64");

      expect(asset.url).toBe("https://example.com/viben-setup.exe");
      expect(asset.name).toBe("Viben_1.0.0_x64-setup.exe");
      expect(asset.size).toBe(80000);
    });

    it("should return EXE for win32-x64 with exe format", () => {
      const asset = getAssetForPlatform(mockReleaseInfo, "win32-x64", "exe");

      expect(asset.url).toBe("https://example.com/viben-setup.exe");
      expect(asset.name).toBe("Viben_1.0.0_x64-setup.exe");
    });

    it("should return MSI for win32-x64 with msi format", () => {
      const asset = getAssetForPlatform(mockReleaseInfo, "win32-x64", "msi");

      expect(asset.url).toBe("https://example.com/viben.msi");
      expect(asset.name).toBe("Viben_1.0.0_x64.msi");
      expect(asset.size).toBe(85000);
    });
  });

  describe("Linux platforms", () => {
    it("should return DEB for linux-x64", () => {
      const asset = getAssetForPlatform(mockReleaseInfo, "linux-x64");

      expect(asset.url).toBe("https://example.com/viben.deb");
      expect(asset.name).toBe("Viben_1.0.0_amd64.deb");
      expect(asset.size).toBe(70000);
    });
  });

  describe("error handling", () => {
    it("should throw error for unsupported platform", () => {
      expect(() => {
        // Type casting to test error path
        getAssetForPlatform(mockReleaseInfo, "freebsd-x64" as SupportedPlatform);
      }).toThrow("PLATFORM_NOT_SUPPORTED");
    });
  });
});

// ============================================================================
// formatBytes
// ============================================================================

describe("formatBytes", () => {
  it("should format 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("should format bytes (< 1KB)", () => {
    expect(formatBytes(500)).toBe("500.0 B");
    expect(formatBytes(1)).toBe("1.0 B");
    expect(formatBytes(1023)).toBe("1023.0 B");
  });

  it("should format kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(10240)).toBe("10.0 KB");
  });

  it("should format megabytes", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(1024 * 1024 * 5.5)).toBe("5.5 MB");
    expect(formatBytes(1024 * 1024 * 100)).toBe("100.0 MB");
  });

  it("should format gigabytes", () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
    expect(formatBytes(1024 * 1024 * 1024 * 2.5)).toBe("2.5 GB");
  });

  it("should handle typical installer sizes", () => {
    // ~80MB Windows installer
    expect(formatBytes(83886080)).toBe("80.0 MB");
    // ~100MB macOS DMG
    expect(formatBytes(104857600)).toBe("100.0 MB");
  });
});

// ============================================================================
// getDefaultDownloadDir
// ============================================================================

describe("getDefaultDownloadDir", () => {
  it("should return Downloads folder in home directory", () => {
    const expected = join(homedir(), "Downloads");
    expect(getDefaultDownloadDir()).toBe(expected);
  });

  it("should return a path that contains 'Downloads'", () => {
    const result = getDefaultDownloadDir();
    expect(result).toContain("Downloads");
  });
});

// ============================================================================
// getManualInstallCommand
// ============================================================================

describe("getManualInstallCommand", () => {
  let originalPlatform: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
  });

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(process, "platform", originalPlatform);
    }
  });

  describe("macOS", () => {
    beforeEach(() => {
      Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    });

    it("should return open command for DMG", () => {
      const result = getManualInstallCommand("/Users/test/Downloads/Viben.dmg");
      expect(result).toBe('open "/Users/test/Downloads/Viben.dmg"');
    });

    it("should handle paths with spaces", () => {
      const result = getManualInstallCommand("/Users/test user/My Downloads/Viben.dmg");
      expect(result).toBe('open "/Users/test user/My Downloads/Viben.dmg"');
    });
  });

  describe("Windows", () => {
    beforeEach(() => {
      Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    });

    it("should return quoted path for EXE", () => {
      const result = getManualInstallCommand("C:\\Users\\test\\Downloads\\Viben.exe");
      expect(result).toBe('"C:\\Users\\test\\Downloads\\Viben.exe"');
    });

    it("should return quoted path for MSI", () => {
      const result = getManualInstallCommand("C:\\Users\\test\\Downloads\\Viben.msi");
      expect(result).toBe('"C:\\Users\\test\\Downloads\\Viben.msi"');
    });

    it("should handle paths with spaces", () => {
      const result = getManualInstallCommand("C:\\Users\\test user\\My Downloads\\Viben.exe");
      expect(result).toBe('"C:\\Users\\test user\\My Downloads\\Viben.exe"');
    });
  });

  describe("Linux", () => {
    beforeEach(() => {
      Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    });

    it("should return apt install command for DEB", () => {
      const result = getManualInstallCommand("/home/test/Downloads/Viben.deb");
      expect(result).toBe('sudo apt install "/home/test/Downloads/Viben.deb"');
    });

    it("should handle paths with spaces", () => {
      const result = getManualInstallCommand("/home/test user/Downloads/Viben.deb");
      expect(result).toBe('sudo apt install "/home/test user/Downloads/Viben.deb"');
    });
  });

  describe("Unknown platform", () => {
    beforeEach(() => {
      Object.defineProperty(process, "platform", { value: "freebsd", configurable: true });
    });

    it("should return just the path for unknown platforms", () => {
      const result = getManualInstallCommand("/path/to/installer");
      expect(result).toBe("/path/to/installer");
    });
  });
});
