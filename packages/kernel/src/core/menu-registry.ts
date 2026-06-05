import type { MenuItem } from './plugin/types.js'
import { createChildLogger } from './utils/log.js'

const log = createChildLogger({ module: 'menu-registry' })

export { type MenuItem }

/**
 * Registry for interactive menu items displayed to users (e.g. Telegram inline keyboards).
 *
 * Core registers default items (new session, agents, help, etc.) during construction.
 * Plugins can add their own items. Items are sorted by priority (lower = higher position)
 * and filtered by an optional `visible()` predicate at render time.
 */
export class MenuRegistry {
  private items = new Map<string, MenuItem>()

  /** Register or replace a menu item by its unique ID. */
  register(item: MenuItem): void {
    this.items.set(item.id, item)
  }

  /** Remove a menu item by ID. */
  unregister(id: string): void {
    this.items.delete(id)
  }

  /** Look up a single menu item by ID. */
  getItem(id: string): MenuItem | undefined {
    return this.items.get(id)
  }

  /** Get all visible items sorted by priority (lower number = shown first). */
  getItems(): MenuItem[] {
    return [...this.items.values()]
      .filter((item) => {
        if (!item.visible) return true
        try {
          return item.visible()
        } catch (err) {
          log.warn({ err, id: item.id }, 'MenuItem visible() threw, hiding item')
          return false
        }
      })
      .sort((a, b) => a.priority - b.priority)
  }
}
