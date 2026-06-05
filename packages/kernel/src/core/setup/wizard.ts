import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import * as clack from "@clack/prompts";
import type { Config, ConfigManager } from "../config/config.js";
import type { ChannelId } from "./types.js";
import type { OnboardSection } from "./types.js";
import { ONBOARD_SECTION_OPTIONS } from "./types.js";
import type { CommunityAdapterOption } from "./types.js";
import { guardCancel, ok, fail, printStartBanner, summarizeConfig } from "./helpers.js";
import { setupAgents } from "./setup-agents.js";
import { setupRunMode } from "./setup-run-mode.js";
import { setupIntegrations } from "./setup-integrations.js";
import { configureChannels } from "./setup-channels.js";
import { RegistryClient } from "../plugin/registry-client.js";
import type { SettingsManager } from "../plugin/settings-manager.js";
import type { PluginRegistry } from "../plugin/plugin-registry.js";
import { InstanceRegistry } from "../instance/instance-registry.js";
import { getGlobalRoot } from "../instance/instance-context.js";
import { randomUUID } from "node:crypto";
import { copyInstance } from "../instance/instance-copy.js";
import { protectLocalInstance } from "./git-protect.js";

// ─── Registry discovery ───

/**
 * Fetches verified community adapter plugins from the Viben registry.
 * Returns an empty array on network failure so setup can proceed without registry access.
 */
async function fetchCommunityAdapters(): Promise<CommunityAdapterOption[]> {
  try {
    const client = new RegistryClient()
    const registry = await client.getRegistry()
    return registry.plugins
      .filter(p => p.category === 'adapter' && p.verified)
      .map(p => ({
        name: p.npm,
        displayName: p.displayName ?? p.name,
        icon: p.icon,
        verified: p.verified,
      }))
  } catch {
    return []
  }
}

// ─── Desktop App detection ───

/**
 * Checks whether the Viben Desktop App is installed by probing
 * platform-specific install locations. Used to show status during setup.
 */
function checkDesktopAppInstalled(): boolean {
  // TODO: replace with exact app bundle / executable path once the Desktop App ships
  const candidates: string[] = [];
  const platform = process.platform;

  if (platform === 'darwin') {
    candidates.push('/Applications/Viben.app');
    candidates.push(`${os.homedir()}/Applications/Viben.app`);
  } else if (platform === 'win32') {
    const localAppData = process.env['LOCALAPPDATA'] ?? '';
    candidates.push(`${localAppData}\\Programs\\Viben\\Viben.exe`);
    candidates.push(`C:\\Program Files\\Viben\\Viben.exe`);
  } else {
    // Linux — check common binary locations
    candidates.push('/usr/bin/viben-desktop');
    candidates.push('/usr/local/bin/viben-desktop');
    candidates.push(`${os.homedir()}/.local/bin/viben-desktop`);
  }

  return candidates.some(p => fs.existsSync(p));
}

// ─── First-run setup ───

/**
 * Runs the interactive first-run setup wizard.
 *
 * The wizard flows through these steps in order:
 *   1. Instance naming
 *   2. Copy-from existing workspace (optional — reuses credentials/settings)
 *   3. Channel selection and configuration (Telegram, Desktop App, plugins)
 *   4. Agent installation and default agent selection
 *   5. Integration setup (Claude CLI session transfer)
 *   6. Run mode selection (foreground vs daemon)
 *
 * On completion, writes config.json, registers the instance in the global
 * registry, and adds .viben/ to .gitignore. The wizard is NOT resumable —
 * if cancelled partway, it must be restarted from scratch.
 *
 * @returns `true` if setup completed successfully, `false` if cancelled or failed
 */
export async function runSetup(
  configManager: ConfigManager,
  opts?: {
    skipRunMode?: boolean
    settingsManager?: SettingsManager
    pluginRegistry?: PluginRegistry
    instanceName?: string
    /** Path to copy from (parent dir, not .viben) */
    from?: string
    /** The .viben dir being set up */
    instanceRoot?: string
  },
): Promise<boolean> {
  await printStartBanner();
  clack.intro("Let's set up Viben");

  const { settingsManager, pluginRegistry } = opts ?? {};

  try {
    if (!settingsManager || !pluginRegistry) {
      console.log(fail('Plugin system not initialized. Cannot set up channels.'));
      return false;
    }

    // ─── Instance name prompt ───

    const instanceRoot = opts?.instanceRoot!;

    let instanceName = opts?.instanceName;
    if (!instanceName) {
      const defaultName = path.basename(path.dirname(instanceRoot));
      const locationHint = instanceRoot.replace(/\/.viben$/, '').replace(os.homedir(), '~');
      const nameResult = await clack.text({
        message: `Name for this workspace (${locationHint})`,
        initialValue: defaultName,
        validate: (v) => (!v?.trim() ? 'Name cannot be empty' : undefined),
      });
      if (clack.isCancel(nameResult)) return false;
      instanceName = nameResult.trim();
    }

    // ─── Copy-from flow ───

    const globalRoot = getGlobalRoot();
    const registryPath = path.join(globalRoot, 'instances.json');
    const instanceRegistry = new InstanceRegistry(registryPath);
    instanceRegistry.load();

    let didCopy = false;

    // Check --from flag first
    if (opts?.from) {
      const fromRoot = path.join(opts.from, '.viben');
      if (fs.existsSync(path.join(fromRoot, 'config.json'))) {
        const inheritableMap = buildInheritableKeysMap();
        await copyInstance(fromRoot, instanceRoot, { inheritableKeys: inheritableMap });
        didCopy = true;
      } else {
        console.error(`No Viben setup found at ${fromRoot}`);
        return false;
      }
    }

    // If no --from, check if we can offer to copy interactively
    if (!didCopy) {
      const existingInstances = instanceRegistry.list().filter(e =>
        fs.existsSync(path.join(e.root, 'config.json')) && e.root !== instanceRoot
      );

      if (existingInstances.length > 0) {
        // Build display label for the single-instance case
        let singleLabel: string | undefined;
        if (existingInstances.length === 1) {
          const e = existingInstances[0]!;
          let name = e.id;
          try {
            const cfg = JSON.parse(fs.readFileSync(path.join(e.root, 'config.json'), 'utf-8'));
            if (cfg.instanceName) name = cfg.instanceName;
          } catch {}
          const displayPath = e.root.replace(os.homedir(), '~');
          singleLabel = `${name} workspace (${displayPath})`;
        }

        const confirmMsg = singleLabel
          ? `Copy config from ${singleLabel}?`
          : 'Copy config from an existing workspace?';

        const shouldCopy = await clack.confirm({
          message: confirmMsg,
          initialValue: true,
        });

        if (clack.isCancel(shouldCopy)) return false;

        if (shouldCopy === true) {
          let sourceRoot: string;
          if (existingInstances.length === 1) {
            sourceRoot = existingInstances[0]!.root;
          } else {
            const choice = await clack.select({
              message: 'Which workspace to copy from?',
              options: existingInstances.map(e => {
                let name = e.id;
                try {
                  const cfg = JSON.parse(fs.readFileSync(path.join(e.root, 'config.json'), 'utf-8'));
                  if (cfg.instanceName) name = cfg.instanceName;
                } catch {}
                const displayPath = e.root.replace(os.homedir(), '~');
                return { value: e.root, label: `${name} workspace (${displayPath})` };
              }),
            });
            if (clack.isCancel(choice)) return false;
            sourceRoot = choice;
          }

          const inheritableMap = buildInheritableKeysMap();
          await copyInstance(sourceRoot, instanceRoot, {
            inheritableKeys: inheritableMap,
            onProgress: (step, status) => {
              if (status === 'done') console.log(`  ✓ ${step}`);
            },
          });
          didCopy = true;
        }
      }
    }

    // If copied, reload config so the wizard sees existing values
    if (didCopy && await configManager.exists()) {
      await configManager.load();
    }

    const communityAdapters = await fetchCommunityAdapters()

    const builtInOptions = [
      { label: 'Desktop App', value: 'sse' },
      { label: 'Telegram', value: 'telegram' },
    ]

    const officialAdapters = [
      { label: 'Discord', value: 'official:@viben/discord-adapter' },
      { label: 'Slack', value: 'official:@viben/slack-adapter' },
    ]

    const communityOptions = communityAdapters.map(a => ({
      label: `${a.icon} ${a.displayName}${a.verified ? ' (verified)' : ''}`,
      value: `community:${a.name}`,
    }))

    // Ask user which channels to set up
    const channelChoices = guardCancel(
      await clack.multiselect({
        message: 'Which channels do you want to set up?',
        options: [
          ...builtInOptions.map(o => ({ value: o.value, label: o.label, hint: 'built-in' })),
          ...officialAdapters.map(o => ({ value: o.value, label: o.label, hint: 'official' })),
          ...(communityOptions.length > 0
            ? communityOptions.map(o => ({ value: o.value, label: o.label, hint: 'from plugin registry' }))
            : []),
        ],
        required: true,
        initialValues: ['sse' as const],
      }),
    ) as string[];

    // Calculate total steps dynamically: channel(s) + workspace + run mode
    const channelSteps = channelChoices.length;
    const runModeSteps = opts?.skipRunMode ? 0 : 1;
    const totalSteps = channelSteps + runModeSteps;

    let currentStep = 0;

    const { createInstallContext } = await import('../plugin/install-context.js');

    for (const channelId of channelChoices) {
      currentStep++;

      if (channelId === 'sse') {
        // TODO: check if the Viben Desktop App is installed; if not, offer to download it.
        // For now, detect common install locations on the current platform.
        const isInstalled = checkDesktopAppInstalled();
        if (isInstalled) {
          clack.log.success('Desktop App detected.');
        } else {
          clack.log.warn(
            'Desktop App not found on this machine.\n' +
            '  TODO: download from https://viben.com/download (download flow not yet implemented).',
          );
        }

        const ssePlugin = (await import('../../plugins/sse-adapter/index.js')).default;
        pluginRegistry.register(ssePlugin.name, {
          version: ssePlugin.version,
          source: 'builtin',
          enabled: true,
          settingsPath: settingsManager.getSettingsPath(ssePlugin.name),
          description: ssePlugin.description,
        });
        continue;
      }

      if (channelId === 'telegram') {
        const telegramPlugin = (await import('../../plugins/telegram/index.js')).default;
        const ctx = createInstallContext({
          pluginName: telegramPlugin.name,
          settingsManager,
          basePath: settingsManager.getBasePath(),
        });
        await telegramPlugin.install!(ctx);
        pluginRegistry.register(telegramPlugin.name, {
          version: telegramPlugin.version,
          source: 'builtin',
          enabled: true,
          settingsPath: settingsManager.getSettingsPath(telegramPlugin.name),
          description: telegramPlugin.description,
        });
      }

      // Handle official adapter selections (Discord, Slack, etc.)
      if (channelId.startsWith('official:')) {
        const npmPackage = channelId.slice('official:'.length);
        const { execFileSync } = await import('node:child_process');
        const pluginsDir = path.join(instanceRoot, 'plugins');
        const nodeModulesDir = path.join(pluginsDir, 'node_modules');

        // Install from npm if not already present
        const installedPath = path.join(nodeModulesDir, npmPackage);
        if (!fs.existsSync(installedPath)) {
          try {
            clack.log.step(`Installing ${npmPackage}...`);
            execFileSync('npm', ['install', npmPackage, '--prefix', pluginsDir, '--save', '--ignore-scripts'], {
              stdio: 'inherit',
              timeout: 60000,
            });
          } catch {
            console.log(fail(`Failed to install ${npmPackage}.`));
            continue;
          }
        }

        // Load and run install hook
        try {
          const installedPkgPath = path.join(nodeModulesDir, npmPackage, 'package.json');
          const installedPkg = JSON.parse(fs.readFileSync(installedPkgPath, 'utf-8'));
          const pluginModule = await import(path.join(nodeModulesDir, npmPackage, installedPkg.main ?? 'dist/index.js'));
          const plugin = pluginModule.default;

          if (plugin?.install) {
            const installCtx = createInstallContext({
              pluginName: plugin.name ?? npmPackage,
              settingsManager,
              basePath: settingsManager.getBasePath(),
            });
            await plugin.install(installCtx);
          }

          pluginRegistry.register(plugin?.name ?? npmPackage, {
            version: installedPkg.version,
            source: 'npm',
            enabled: true,
            settingsPath: settingsManager.getSettingsPath(plugin?.name ?? npmPackage),
            description: plugin?.description ?? installedPkg.description,
          });
        } catch (err) {
          console.log(fail(`Failed to load ${npmPackage}: ${(err as Error).message}`));
          pluginRegistry.register(npmPackage, {
            version: 'unknown',
            source: 'npm',
            enabled: false,
            settingsPath: settingsManager.getSettingsPath(npmPackage),
          });
        }
      }

      // Handle community plugin selections
      if (channelId.startsWith('community:')) {
        const npmPackage = channelId.slice('community:'.length);
        const { execFileSync } = await import('node:child_process');
        const pluginsDir = path.join(instanceRoot, 'plugins');
        const nodeModulesDir = path.join(pluginsDir, 'node_modules');

        // Install from npm
        try {
          execFileSync('npm', ['install', npmPackage, '--prefix', pluginsDir, '--save', '--ignore-scripts'], {
            stdio: 'inherit',
            timeout: 60000,
          });
        } catch {
          console.log(fail(`Failed to install ${npmPackage}.`));
          return false;
        }

        // Load and run install hook
        try {
          const { readFileSync } = await import('node:fs');
          const installedPkgPath = path.join(nodeModulesDir, npmPackage, 'package.json');
          const installedPkg = JSON.parse(readFileSync(installedPkgPath, 'utf-8'));
          const pluginModule = await import(path.join(nodeModulesDir, npmPackage, installedPkg.main ?? 'dist/index.js'));
          const plugin = pluginModule.default;

          if (plugin?.install) {
            const installCtx = createInstallContext({
              pluginName: plugin.name ?? npmPackage,
              settingsManager,
              basePath: settingsManager.getBasePath(),
            });
            await plugin.install(installCtx);
          }

          pluginRegistry.register(plugin?.name ?? npmPackage, {
            version: installedPkg.version,
            source: 'npm',
            enabled: true,
            settingsPath: settingsManager.getSettingsPath(plugin?.name ?? npmPackage),
            description: plugin?.description ?? installedPkg.description,
          });
        } catch (err) {
          // Plugin installed via npm but failed to load — register as disabled
          console.log(fail(`Failed to load ${npmPackage}: ${(err as Error).message}`));
          pluginRegistry.register(npmPackage, {
            version: 'unknown',
            source: 'npm',
            enabled: false,
            settingsPath: settingsManager.getSettingsPath(npmPackage),
          });
        }
      }
    }

    // Persist any community plugin registrations from the loop above
    await pluginRegistry.save();

    const { defaultAgent } = await setupAgents(instanceRoot);

    // Offer Claude CLI integration
    await setupIntegrations();

    let runMode: 'foreground' | 'daemon' = 'foreground';
    let autoStart = false;
    if (!opts?.skipRunMode) {
      currentStep++;
      const result = await setupRunMode({ stepNum: currentStep, totalSteps, instanceRoot });
      runMode = result.runMode;
      autoStart = result.autoStart;
    }

    const security = {
      allowedUserIds: [] as string[],
      maxConcurrentSessions: 20,
      sessionTimeoutMinutes: 60,
    };

    // Resolve or create UUID before writing config — id must be in config.json from the start
    const existingEntry = instanceRegistry.getByRoot(instanceRoot);
    const instanceId = existingEntry?.id ?? randomUUID();

    const config: Config = {
      id: instanceId,
      instanceName,
      defaultAgent,
      workspace: { allowExternalWorkspaces: true, security: { allowedPaths: [], envWhitelist: [] } },
      logging: {
        level: "info",
        logDir: path.join(instanceRoot, "logs"),
        maxFileSize: "10m",
        maxFiles: 7,
        sessionLogRetentionDays: 30,
      },
      runMode,
      autoStart,
      sessionStore: { ttlDays: 30 },
      integrations: {},
      agentSwitch: { labelHistory: true },
    };

    try {
      await configManager.writeNew(config);
    } catch (writeErr) {
      console.log(
        fail(`Could not save config: ${(writeErr as Error).message}`),
      );
      return false;
    }

    // Auto-register remaining built-in plugins in the registry
    if (settingsManager && pluginRegistry) {
      await registerBuiltinPlugins(settingsManager, pluginRegistry);
      await pluginRegistry.save();
    }

    // Register instance in the global registry (now after config write; UUID already decided above)
    if (!existingEntry) {
      instanceRegistry.register(instanceId, instanceRoot);
      await instanceRegistry.save();
    }

    // Protect secrets from git and document in CLAUDE.md
    const projectDir = path.dirname(instanceRoot);
    protectLocalInstance(projectDir);

    clack.outro(`Config saved to ${configManager.getConfigPath()}`);

    if (!opts?.skipRunMode) {
      console.log(ok("Starting Viben..."));
      console.log("");
    }

    return true;
  } catch (err) {
    if ((err as Error).name === "ExitPromptError") {
      clack.cancel("Setup cancelled.");
      return false;
    }
    throw err;
  }
}

/**
 * Register all built-in plugins that haven't been registered yet.
 * Called after first-run setup to populate the registry with defaults.
 */
async function registerBuiltinPlugins(
  settingsManager: SettingsManager,
  pluginRegistry: PluginRegistry,
): Promise<void> {
  const builtinPlugins = [
    { name: '@viben/security', version: '1.0.0', description: 'User access control and session limits' },
    { name: '@viben/file-service', version: '1.0.0', description: 'File storage and management' },
    { name: '@viben/context', version: '1.0.0', description: 'Conversation context management' },
    { name: '@viben/speech', version: '1.0.0', description: 'Text-to-speech and speech-to-text' },
    { name: '@viben/notifications', version: '1.0.0', description: 'Cross-session notification routing' },
    { name: '@viben/tunnel', version: '1.0.0', description: 'Expose local services via tunnel' },
    { name: '@viben/api-server', version: '1.0.0', description: 'REST API + SSE streaming server' },
  ];

  for (const p of builtinPlugins) {
    if (!pluginRegistry.get(p.name)) {
      pluginRegistry.register(p.name, {
        version: p.version,
        source: 'builtin',
        enabled: true,
        settingsPath: settingsManager.getSettingsPath(p.name),
        description: p.description,
      });
    }
  }
}

// ─── Inheritable keys for copy flow ───

/**
 * Returns the set of plugin settings keys that are safe to copy between workspaces.
 *
 * Only non-secret, structural settings are included. Secrets (tokens, API keys)
 * are NOT inherited — each workspace must configure its own credentials.
 *
 * This map covers built-in plugins only. Community plugins declare their own
 * inheritable keys in their plugin definition and handle copying themselves.
 */
function buildInheritableKeysMap(): Record<string, string[]> {
  return {
    '@viben/tunnel': ['provider', 'maxUserTunnels', 'auth'],
    '@viben/api-server': ['host'],
    '@viben/security': ['allowedUsers', 'maxSessionsPerUser', 'rateLimits'],
    '@viben/usage': ['budget'],
    '@viben/speech': ['tts'],
  };
}

// ─── Reconfigure (section-based, for existing config) ───

type ReconfigureSection = OnboardSection | "__continue";

async function selectSection(hasSelection: boolean): Promise<ReconfigureSection> {
  return guardCancel(
    await clack.select({
      message: "Select sections to configure",
      options: [
        ...ONBOARD_SECTION_OPTIONS,
        {
          value: "__continue" as const,
          label: "Continue",
          hint: hasSelection ? "Done" : "Skip for now",
        },
      ],
      initialValue: ONBOARD_SECTION_OPTIONS[0].value,
    }),
  ) as ReconfigureSection;
}

/**
 * Runs the reconfigure wizard for an existing Viben installation.
 *
 * Unlike `runSetup`, this presents a section-picker menu and lets users
 * modify individual sections (channels, agents, run mode, integrations)
 * in any order. The loop continues until the user selects "Continue".
 */
export async function runReconfigure(configManager: ConfigManager, settingsManager?: SettingsManager): Promise<void> {
  await printStartBanner();
  clack.intro("Viben — Reconfigure");

  try {
    await configManager.load();
    let config = configManager.get();

    // Show current config summary
    clack.note(await summarizeConfig(config, settingsManager), "Current configuration");

    let ranSection = false;

    while (true) {
      const choice = await selectSection(ranSection);
      if (choice === "__continue") break;
      ranSection = true;

      if (choice === "channels") {
        // configureChannels now updates plugin settings directly (channels migrated out of config.json)
        await configureChannels(config, settingsManager);
      }

      if (choice === "agents") {
        const reconfigRoot = path.dirname(configManager.getConfigPath());
        const { defaultAgent } = await setupAgents(reconfigRoot);
        await configManager.save({ defaultAgent });
        config = configManager.get();
      }

      if (choice === "runMode") {
        const result = await setupRunMode({
          existing: { runMode: config.runMode, autoStart: config.autoStart },
        });
        await configManager.save({
          runMode: result.runMode,
          autoStart: result.autoStart,
        });
        config = configManager.get();
      }

      if (choice === "integrations") {
        await setupIntegrations();
      }
    }

    if (!ranSection) {
      clack.outro("No changes made.");
      return;
    }

    clack.outro(`Config saved to ${configManager.getConfigPath()}`);
  } catch (err) {
    if ((err as Error).name === "ExitPromptError") {
      clack.cancel("Setup cancelled.");
      return;
    }
    throw err;
  }
}
