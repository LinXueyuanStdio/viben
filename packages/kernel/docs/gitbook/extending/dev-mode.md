# Dev Mode

Dev mode lets you load a local plugin into a running Viben instance with automatic hot-reload on file changes. This is the fastest way to develop and debug plugins.

---

## What Is Dev Mode?

When you run `viben dev <path>`, Viben:

1. Compiles your plugin's TypeScript (if `tsconfig.json` exists)
2. Starts `tsc --watch` in the background for continuous compilation
3. Boots the Viben server with your local plugin loaded alongside all other plugins
4. Watches the `dist/` directory for changes and reloads your plugin automatically

Your plugin runs in the same environment as a production install -- same PluginContext, same services, same event bus. The only difference is that it is loaded from a local path instead of `~/.viben/plugins/`.

---

## Usage

```bash
viben dev <plugin-path> [options]
```

**Options:**

| Flag | Description |
|---|---|
| `--no-watch` | Disable file watching (no hot-reload, no `tsc --watch`) |
| `--verbose` | Enable verbose logging (shows `tsc --watch` output and debug logs) |

**Examples:**

```bash
# Develop a plugin in the current directory
viben dev .

# Develop a plugin at a specific path
viben dev ./my-plugin

# Develop without hot-reload
viben dev ../adapter-matrix --no-watch

# Develop with verbose logging
viben dev ./my-plugin --verbose
```

---

## TypeScript Support

Dev mode automatically handles TypeScript compilation:

1. **Initial compile**: Runs `npx tsc` in your plugin directory before starting the server. If compilation fails, the process exits with an error.

2. **Watch mode**: Unless `--no-watch` is passed, starts `npx tsc --watch --preserveWatchOutput` in the background. Output is hidden unless `--verbose` is set.

3. **Auto-reload**: When `tsc --watch` recompiles and updates files in `dist/`, the plugin is automatically reloaded.

If your plugin is plain JavaScript (no `tsconfig.json`), the TypeScript steps are skipped and the plugin is loaded directly.

---

## Hot-Reload Behavior

### What happens on file change

When a file in your plugin's `dist/` directory changes:

1. The current plugin instance's `teardown()` is called (if defined)
2. The plugin module is re-imported from `dist/index.js`
3. The new plugin's `setup()` is called with a fresh `PluginContext`
4. Services, commands, middleware, and event listeners are re-registered

### How ESM cache busting works

Node.js caches ESM modules by URL. To force a fresh import on reload, the dev loader copies `dist/index.js` to a temporary file with a unique name, imports from there, then cleans up the temp file. This ensures you always get the latest code.

### Limitations

- **Entry file only**: The watcher monitors `dist/index.js`. If your plugin imports other local modules, those modules are also refreshed as part of the re-import, but changes to deeply nested dependencies may require a manual restart.
- **State loss**: On reload, all in-memory state from the previous plugin instance is lost. Use `ctx.storage` for data that should survive reloads.
- **Side effects**: If your plugin creates external resources (database connections, webhooks), make sure `teardown()` cleans them up to avoid leaks on reload.

---

## Debugging Tips

### Enable verbose logging

```bash
viben dev ./my-plugin --verbose
```

This shows:
- TypeScript compiler output (errors and warnings)
- Plugin load/unload events
- All debug-level log messages from your plugin

### Use ctx.log for plugin logging

```typescript
async setup(ctx: PluginContext) {
  ctx.log.info('Plugin loaded')
  ctx.log.debug('Config:', ctx.pluginConfig)
  ctx.log.warn('Something might be wrong')
  ctx.log.error('Something went wrong', error)
}
```

In dev mode with `--verbose`, all log levels are visible.

### Check the Viben logs

If the server logs to a file (configured via `logging.logDir`), tail those logs in another terminal:

```bash
viben logs
```

---

## Troubleshooting

### TypeScript compilation fails

```
TypeScript compilation failed. Fix errors and try again.
```

Fix the TypeScript errors in your source code and run `viben dev` again. The initial compile must succeed before the server starts.

### Plugin not found

```
Error: plugin path does not exist: /path/to/plugin
```

Make sure the path exists and is a directory containing either `dist/index.js` (compiled) or `src/index.ts` (source).

### Built plugin not found

```
Error: Built plugin not found at /path/to/plugin/dist/index.js. Run 'npm run build' first.
```

Your plugin has source files but no compiled output. Run `npm run build` in the plugin directory first, or let `viben dev` handle it (it compiles automatically if `tsconfig.json` exists).

### Invalid plugin

```
Error: Invalid plugin at dist/index.js. Must export default VibenPlugin with name and setup().
```

Your plugin must have a default export that includes at least `name` (string) and `setup` (function). Check your `src/index.ts`:

```typescript
const plugin: VibenPlugin = {
  name: '@myorg/my-plugin',  // required
  version: '0.1.0',
  setup(ctx) { ... },        // required
}
export default plugin         // must be default export
```

### Changes not taking effect

If hot-reload does not pick up your changes:

1. Check that `tsc --watch` is running (use `--verbose` to see its output)
2. Verify that `dist/index.js` is being updated (check its modification time)
3. Try stopping and restarting `viben dev`
4. If using `--no-watch`, rebuild manually with `npm run build`

---

## Further Reading

- [Getting Started: Your First Plugin](getting-started-plugin.md) -- end-to-end tutorial
- [Plugin SDK Reference](plugin-sdk-reference.md) -- complete API reference
- [Writing Plugins](../architecture/writing-plugins.md) -- full guide to plugin APIs
