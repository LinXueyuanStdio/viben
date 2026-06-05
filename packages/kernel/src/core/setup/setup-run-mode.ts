import * as clack from "@clack/prompts";
import { expandHome } from "../config/config.js";
import { guardCancel, ok, warn, dim, step } from "./helpers.js";

/**
 * Prompts the user to choose between foreground and daemon run modes.
 *
 * Daemon mode installs an OS-level autostart entry (launchd on macOS,
 * systemd on Linux). When switching from daemon to foreground, the
 * running daemon is stopped and autostart is uninstalled.
 *
 * Daemon mode is not available on Windows — the function silently
 * defaults to foreground in that case.
 */
export async function setupRunMode(opts?: {
  existing?: { runMode: string; autoStart: boolean };
  stepNum?: number;
  totalSteps?: number;
  instanceRoot?: string;
}): Promise<{ runMode: 'foreground' | 'daemon'; autoStart: boolean }> {
  const { existing, stepNum, totalSteps } = opts ?? {};
  if (stepNum != null && totalSteps != null) {
    console.log(step(stepNum, totalSteps, 'Run Mode'));
  }

  // Don't show daemon option on Windows
  if (process.platform === 'win32') {
    console.log(dim('  (Daemon mode not available on Windows)'));
    return { runMode: 'foreground', autoStart: false };
  }

  const initialValue = (existing?.runMode === 'daemon' ? 'daemon' : 'foreground') as 'foreground' | 'daemon';

  const mode = guardCancel(
    await clack.select({
      message: 'How would you like to run Viben?',
      options: [
        {
          label: 'Background (daemon)',
          value: 'daemon' as const,
          hint: 'Runs silently, auto-starts on boot. Manage with: viben status | stop | logs',
        },
        {
          label: 'Foreground (terminal)',
          value: 'foreground' as const,
          hint: 'Runs in current terminal session. Start with: viben',
        },
      ],
      initialValue,
    }),
  );

  const wasDaemon = existing?.runMode === 'daemon';

  if (mode === 'daemon') {
    const { installAutoStart, isAutoStartSupported } = await import('../../cli/autostart.js');
    const { resolveInstanceId } = await import('../../cli/resolve-instance-id.js');
    const { muteLogger, unmuteLogger } = await import('../utils/log.js');
    const autoStart = isAutoStartSupported();
    if (autoStart) {
      muteLogger();
      const logDir = opts?.instanceRoot ? `${opts.instanceRoot}/logs` : expandHome('~/.viben/logs');
      const instanceId = opts?.instanceRoot ? resolveInstanceId(opts.instanceRoot) : 'default';
      const result = installAutoStart(logDir, opts?.instanceRoot ?? expandHome('~/.viben'), instanceId);
      unmuteLogger();
      if (result.success) {
        console.log(ok('Auto-start on boot enabled'));
      } else {
        console.log(warn(`Auto-start failed: ${result.error}`));
      }
    }
    return { runMode: 'daemon', autoStart };
  }

  // Switching from daemon → foreground: stop daemon + uninstall autostart
  if (wasDaemon) {
    const { muteLogger, unmuteLogger } = await import('../utils/log.js');
    muteLogger();
    try {
      const { stopDaemon, getPidPath } = await import('../../cli/daemon.js');
      const instanceRoot = opts?.instanceRoot!;
      const result = await stopDaemon(getPidPath(instanceRoot), instanceRoot);
      if (result.stopped) {
        console.log(ok(`Daemon stopped (was PID ${result.pid})`));
      }
      const { uninstallAutoStart } = await import('../../cli/autostart.js');
      const { resolveInstanceId } = await import('../../cli/resolve-instance-id.js');
      const instanceId = opts?.instanceRoot ? resolveInstanceId(opts.instanceRoot) : 'default';
      uninstallAutoStart(instanceId);
    } catch {
      // Daemon may not be running or autostart may not be installed
    } finally {
      unmuteLogger();
    }
  }

  return { runMode: 'foreground', autoStart: false };
}
