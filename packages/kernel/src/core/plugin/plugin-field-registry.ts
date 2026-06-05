import type { FieldDef } from './types.js'

/**
 * Central registry for plugin-declared editable fields.
 *
 * Plugins call `ctx.registerEditableFields()` during setup to declare which
 * settings keys are exposed via the API/UI for dynamic configuration.
 * The API server reads from this registry to render settings forms and
 * validate updates. Registered as service 'field-registry' in main.ts.
 */
export class PluginFieldRegistry {
  private fields = new Map<string, FieldDef[]>()

  /** Register (or replace) the editable fields for a plugin. */
  register(pluginName: string, fields: FieldDef[]): void {
    this.fields.set(pluginName, fields)
  }

  /** Get the editable fields for a specific plugin. */
  getForPlugin(pluginName: string): FieldDef[] {
    return this.fields.get(pluginName) ?? []
  }

  /** Get all fields grouped by plugin name. */
  getAll(): Map<string, FieldDef[]> {
    return new Map(this.fields)
  }
}
