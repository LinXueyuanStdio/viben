# Updating

## Check Your Current Version

```bash
viben --version
```

This prints the version from the installed package (e.g., `2026.401.1`). The version is read from `package.json` bundled with the binary.

Viben also checks for updates automatically at startup. If a newer version is available on npm, you are prompted:

```
Update available: 2026.327.1 → 2026.401.1
? Update now before starting?
```

Selecting yes runs `npm install -g @viben/kernel@latest` in-process and exits, asking you to re-run your command with the new version. Set `VIBEN_SKIP_UPDATE_CHECK=true` to suppress this prompt.

## Update

```bash
npm update -g @viben/kernel
```

Or to pin to a specific version:

```bash
npm install -g @viben/kernel@2026.401.1
```

If you are running from source, pull and rebuild:

```bash
git pull
pnpm install
pnpm build
```

## Backward Compatibility Guarantee

Viben guarantees that existing config files, session data, and stored state continue to work after any minor or patch upgrade without manual intervention.

Specific commitments:

- **Config schema**: New fields always have `.default()` or `.optional()` in the Zod schema. An older config file will never fail validation after an upgrade.
- **CLI commands and flags**: Existing commands and flags are never removed or renamed in a minor/patch release. Deprecated commands are kept operational with a warning until the next major version.
- **Plugin API**: Plugin-facing interfaces maintain backward compatibility within a major version.
- **Data files**: All instance files (sessions, topics, state) are handled defensively — unknown fields are preserved and old formats are migrated automatically.
- **Instance migration**: If an existing global instance is detected at `~/.viben/` on first run after upgrade, it is automatically migrated to `~/viben-workspace/.viben/`. No manual action required.

## Automatic Config Migrations

When Viben starts, it runs all pending config migrations before validation. Migrations are applied to the raw JSON in memory and written back to disk if any change was made. You do not need to edit the file manually after an upgrade.

Current migrations (run in order):

1. **`add-tunnel-section`** — Adds the `tunnel` block with Cloudflare defaults if the key is absent.
2. **`fix-agent-commands`** — Renames legacy agent command values to their current names.
3. **`migrate-agents-to-store`** — Moves agent definitions from `config.json` into the separate `<instance-root>/agents.json` store introduced in a later release.

In addition, a one-time **global instance migration** runs at CLI startup. If a legacy `~/.viben/config.json` is detected, it is automatically moved to `~/viben-workspace/.viben/` and registered in the instance registry.

Migrations are idempotent: running them multiple times has no effect.

## Post-Upgrade Checks

After upgrading, start Viben normally:

```bash
viben start
```

If there are any issues with the config (e.g., a field that could not be migrated), the process prints the validation errors and exits with a non-zero code. Review the output and correct the config file at `<instance-root>/config.json`.

For plugin adapters installed under `<instance-root>/plugins/`, re-install them after a major upgrade to ensure API compatibility:

```bash
viben install @viben/adapter-discord
```
