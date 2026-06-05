/**
 * Prints the full CLI help text to stdout, covering all commands, flags, and usage examples.
 *
 * Called when the user runs `viben --help` or `viben -h` with no subcommand.
 */
export function printHelp(): void {
  console.log(`
\x1b[1mViben\x1b[0m — Self-hosted bridge for AI coding agents
Connect messaging platforms (Telegram, Discord) to 28+ AI coding agents via ACP protocol.

\x1b[1mGetting Started:\x1b[0m
  viben                              First run launches setup wizard
  viben                              After setup, starts the server

\x1b[1mServer:\x1b[0m
  viben                              Start (mode from config)
  viben start                        Start as background daemon  \x1b[2m[--json]\x1b[0m
  viben stop                         Stop background daemon       \x1b[2m[--json]\x1b[0m
  viben restart                      Restart (same mode)          \x1b[2m[--json]\x1b[0m
  viben restart --foreground         Restart in foreground mode
  viben restart --daemon             Restart as background daemon
  viben attach                       Attach to running daemon
  viben status                       Show daemon status           \x1b[2m[--json]\x1b[0m
  viben logs                         Tail daemon log file
  viben --foreground                 Force foreground mode

\x1b[1mAgent Management:\x1b[0m
  viben agents                       Browse all agents (installed + available)  \x1b[2m[--json]\x1b[0m
  viben agents install <name>        Install an agent from the ACP Registry     \x1b[2m[--json]\x1b[0m
  viben agents uninstall <name>      Remove an installed agent                  \x1b[2m[--json]\x1b[0m
  viben agents info <name>           Show details, dependencies & setup guide   \x1b[2m[--json]\x1b[0m
  viben agents run <name> [-- args]  Run agent CLI directly (login, config...)
  viben agents refresh               Force-refresh agent list from registry

  \x1b[2mExamples:\x1b[0m
    viben agents install gemini           Install Gemini CLI
    viben agents run gemini               Login to Google (first run)
    viben agents info cursor              See setup instructions

\x1b[1mConfiguration:\x1b[0m
  viben config                       Interactive config editor
  viben config set <key> <value>     Set a config value  \x1b[2m[--json]\x1b[0m
  viben onboard                      Re-run onboarding setup wizard
  viben reset                        Re-run setup wizard
  viben update                       Update to latest version
  viben doctor                       Run system diagnostics  \x1b[2m[--json]\x1b[0m
  viben doctor --dry-run             Check only, don't fix

\x1b[1mPlugins:\x1b[0m
  viben install <package>            Install adapter plugin    \x1b[2m[--json]\x1b[0m
  viben uninstall <package>          Remove adapter            \x1b[2m[--json]\x1b[0m
  viben plugins                      List installed plugins    \x1b[2m[--json]\x1b[0m
  viben plugin create                Scaffold a new plugin project

\x1b[1mDevelopment:\x1b[0m
  viben dev <plugin-path>            Run with local plugin (hot-reload)
  viben dev <path> --no-watch        Run without file watching
  viben dev <path> --verbose         Run with verbose logging

\x1b[1mSession Transfer:\x1b[0m
  viben integrate <agent>            Install handoff integration
  viben integrate <agent> --uninstall
  viben adopt <agent> <id>           Adopt an external session  \x1b[2m[--json]\x1b[0m
  viben channels                     List connected channel adapters  \x1b[2m[--json]\x1b[0m

\x1b[1mRemote Access:\x1b[0m
  viben remote                            Generate one-time remote access link  \x1b[2m[--json]\x1b[0m
  viben remote --role admin               Specify role: admin (default) or viewer
  viben remote --expire 48h              Set expiry duration (default: 24h)
  viben remote --no-tunnel               Local link only (skip tunnel URL)
  viben remote --no-qr                   Skip QR code output
  viben remote --name <label>            Custom token name

\x1b[1mTunnels:\x1b[0m
  viben tunnel add <port> [--label name]  Create tunnel to local port  \x1b[2m[--json]\x1b[0m
  viben tunnel list                       List active tunnels           \x1b[2m[--json]\x1b[0m
  viben tunnel stop <port>                Stop a tunnel                 \x1b[2m[--json]\x1b[0m
  viben tunnel stop-all                   Stop all user tunnels         \x1b[2m[--json]\x1b[0m

\x1b[1mDaemon API:\x1b[0m \x1b[2m(requires running daemon)\x1b[0m
  viben api status                   Active sessions     \x1b[2m[--json]\x1b[0m
  viben api session <id>             Session details     \x1b[2m[--json]\x1b[0m
  viben api new [agent] [workspace]  Create session      \x1b[2m[--json]\x1b[0m
  viben api send <id> <prompt>       Send prompt         \x1b[2m[--json]\x1b[0m
  viben api cancel <id>              Cancel session      \x1b[2m[--json]\x1b[0m
  viben api bypass <id> on|off       Toggle bypass permissions  \x1b[2m[--json]\x1b[0m
  viben api topics [--status ...]    List topics         \x1b[2m[--json]\x1b[0m
  viben api cleanup [--status ...]   Cleanup old topics  \x1b[2m[--json]\x1b[0m
  viben api health                   System health check \x1b[2m[--json]\x1b[0m
  viben api restart                  Restart daemon      \x1b[2m[--json]\x1b[0m

\x1b[1mWorkspace Flags:\x1b[0m
  --local              Use workspace in current directory
  --global             (deprecated, ignored)
  --dir <path>         Use workspace at specified directory
  --from <path>        Copy settings from existing workspace (on create)
  --name <name>        Set workspace name (on create)

\x1b[1mOutput Flags:\x1b[0m
  --json               Output result as JSON (single-line, stdout)
                       Commands marked \x1b[2m[--json]\x1b[0m support machine-readable output.
                       Success: { "success": true, "data": { ... } }
                       Error:   { "success": false, "error": { "code": "...", "message": "..." } }

\x1b[2mMore info: https://github.com/LinXueyuanStdio/viben\x1b[0m
`)
}
