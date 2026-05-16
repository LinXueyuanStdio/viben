import { create } from "zustand";
import type { ClientToolResult } from "@/lib/client-side-tool/types";
import type { ActionDef, ActionInfo, ActionDetail, ExecutionContext, JSONSchema7 } from "@/lib/action-system/types";

interface ActionProviderRegistration {
  id: string;
  namespace: string;
  actions: ActionDef[];
  registeredAt: number;
}

interface ActionStoreState {
  /** Registry: provider id -> provider registration */
  registry: Map<string, ActionProviderRegistration>;

  /** Register actions under a namespace for one provider instance. */
  register: (providerId: string, namespace: string, actions: ActionDef[]) => void;

  /** Unregister one provider instance. */
  unregister: (providerId: string) => void;

  /** Get all registered actions as ActionInfo[] (with namespace.name format). */
  listActions: () => ActionInfo[];

  /** Get detail for a specific action by full name (namespace.name). */
  getActionDetail: (fullName: string) => ActionDetail | null;

  /** Execute an action by full name. Returns error result if action not found. */
  execute: (fullName: string, payload: unknown, ctx: ExecutionContext) => Promise<ClientToolResult>;
}

export const useActionStore = create<ActionStoreState>()((set, get) => ({
  registry: new Map(),

  register: (providerId, namespace, actions) => {
    set((state) => {
      const newRegistry = new Map(state.registry);
      newRegistry.set(providerId, {
        id: providerId,
        namespace,
        actions,
        registeredAt: newRegistry.get(providerId)?.registeredAt ?? Date.now(),
      });
      return { registry: newRegistry };
    });
  },

  unregister: (providerId) => {
    set((state) => {
      const newRegistry = new Map(state.registry);
      newRegistry.delete(providerId);
      return { registry: newRegistry };
    });
  },

  listActions: () => {
    const actionsByName = new Map<string, ActionInfo>();
    for (const provider of getProvidersInPriorityOrder(get().registry)) {
      const { namespace, actions: defs } = provider;
      for (const def of defs) {
        const name = `${namespace}.${def.name}`;
        if (actionsByName.has(name)) continue;
        actionsByName.set(name, {
          name,
          description: def.description,
        });
      }
    }
    return [...actionsByName.values()];
  },

  getActionDetail: (fullName) => {
    const resolved = resolveAction(get().registry, fullName);
    const def = resolved?.def;
    if (!def) return null;

    return {
      name: fullName,
      description: def.description,
      input_schema: def.input_schema,
      output_schema: def.output_schema,
    };
  },

  execute: async (fullName, payload, ctx) => {
    const resolved = resolveAction(get().registry, fullName);
    if (!resolved) {
      return {
        content: [{ type: "text", text: `action_not_available: "${fullName}" is not registered` }],
        isError: true,
      };
    }

    const { def } = resolved;
    const inputError = validateJsonSchema(payload, def.input_schema, "input");
    if (inputError) {
      return {
        content: [{ type: "text", text: `validation_error: ${inputError}` }],
        isError: true,
      };
    }

    const result = await def.execute(payload, ctx);
    const outputError = validateJsonSchema(result.structuredContent ?? result, def.output_schema, "output");
    if (outputError) {
      return {
        content: [{ type: "text", text: `output_validation_error: ${outputError}` }],
        isError: true,
      };
    }

    return result;
  },
}));

function getProvidersInPriorityOrder(registry: Map<string, ActionProviderRegistration>): ActionProviderRegistration[] {
  return [...registry.values()].sort((a, b) => b.registeredAt - a.registeredAt);
}

function resolveAction(
  registry: Map<string, ActionProviderRegistration>,
  fullName: string
): { provider: ActionProviderRegistration; def: ActionDef } | null {
  const dotIndex = fullName.indexOf(".");
  if (dotIndex === -1) return null;

  const namespace = fullName.slice(0, dotIndex);
  const name = fullName.slice(dotIndex + 1);
  for (const provider of getProvidersInPriorityOrder(registry)) {
    if (provider.namespace !== namespace) continue;
    const def = provider.actions.find((d) => d.name === name);
    if (def) return { provider, def };
  }

  return null;
}

function validateJsonSchema(value: unknown, schema: JSONSchema7 | undefined, label: string): string | null {
  if (!schema) return null;
  return validateAgainstSchema(value, schema, label);
}

function validateAgainstSchema(value: unknown, schema: JSONSchema7, path: string): string | null {
  const type = schema.type;
  if (typeof type === "string") {
    const typeError = validateType(value, type, path);
    if (typeError) return typeError;
  }

  if (schema.enum && Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    return `${path} must be one of ${schema.enum.map(String).join(", ")}`;
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const key of required) {
      if (typeof key === "string" && record[key] === undefined) {
        return `${path}.${key} is required`;
      }
    }

    const properties = schema.properties;
    if (properties && typeof properties === "object" && !Array.isArray(properties)) {
      for (const [key, propSchema] of Object.entries(properties)) {
        if (record[key] === undefined) continue;
        const nestedError = validateAgainstSchema(record[key], propSchema as JSONSchema7, `${path}.${key}`);
        if (nestedError) return nestedError;
      }
    }
  }

  return null;
}

function validateType(value: unknown, type: string, path: string): string | null {
  switch (type) {
    case "object":
      return value !== null && typeof value === "object" && !Array.isArray(value)
        ? null
        : `${path} must be an object`;
    case "array":
      return Array.isArray(value) ? null : `${path} must be an array`;
    case "string":
      return typeof value === "string" ? null : `${path} must be a string`;
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? null : `${path} must be a finite number`;
    case "integer":
      return typeof value === "number" && Number.isInteger(value) ? null : `${path} must be an integer`;
    case "boolean":
      return typeof value === "boolean" ? null : `${path} must be a boolean`;
    case "null":
      return value === null ? null : `${path} must be null`;
    default:
      return null;
  }
}
