import { useEffect, useId } from "react";
import { useActionStore } from "@/stores/action-store";
import type { ClientToolResult } from "@/lib/client-side-tool/types";
import type { ExecutionContext, JSONSchema7 } from "@/lib/action-system/types";

/** Action definition without the 'name' field (name comes from the object key) */
export interface ActionProviderEntry {
  description: string;
  input_schema?: JSONSchema7;
  output_schema?: JSONSchema7;
  execute: (payload: unknown, ctx: ExecutionContext) => Promise<ClientToolResult>;
}

/**
 * Register actions under a namespace. Actions are automatically unregistered on unmount.
 *
 * IMPORTANT: The `actions` parameter must be referentially stable (use useMemo or module-level constant).
 * Unstable references will cause re-registration on every render.
 *
 * @param namespace - Unique namespace prefix (e.g., 'chat', 'presentation')
 * @param actions - Record of action name → definition
 */
export function useActionProvider(
  namespace: string,
  actions: Record<string, ActionProviderEntry>
): void {
  const reactId = useId();
  const register = useActionStore((s) => s.register);
  const unregister = useActionStore((s) => s.unregister);

  useEffect(() => {
    const providerId = `${namespace}:${reactId}`;
    const defs = Object.entries(actions).map(([name, def]) => ({
      name,
      ...def,
    }));
    const actionNames = defs.map((def) => `${namespace}.${def.name}`);
    console.info("[ActionProvider] register", {
      providerId,
      namespace,
      actionCount: defs.length,
      actions: actionNames,
    });
    register(providerId, namespace, defs);
    return () => {
      console.info("[ActionProvider] unregister", {
        providerId,
        namespace,
        actionCount: defs.length,
        actions: actionNames,
      });
      unregister(providerId);
    };
  }, [namespace, reactId, actions, register, unregister]);
}
