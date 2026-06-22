import type {
  ActionDescriptor,
  ActionManifest,
  ActionPermission,
  BridgeEnvelope
} from "@viben/protocol";

const permissionWeight: Record<ActionPermission, number> = {
  read: 1,
  write: 2,
  dangerous: 3,
  local: 4
};

export interface ActionManifestSummary {
  actionCount: number;
  highestPermission: ActionPermission | null;
  requiresConfirmation: boolean;
}

export function summarizeActionManifest(manifest: ActionManifest): ActionManifestSummary {
  let highestPermission: ActionPermission | null = null;

  for (const action of manifest.actions) {
    if (
      !highestPermission ||
      permissionWeight[action.permission] > permissionWeight[highestPermission]
    ) {
      highestPermission = action.permission;
    }
  }

  return {
    actionCount: manifest.actions.length,
    highestPermission,
    requiresConfirmation: manifest.actions.some(
      (action) => action.permission === "write" || action.permission === "dangerous"
    )
  };
}

export function findAction(manifest: ActionManifest, actionId: string): ActionDescriptor | null {
  return manifest.actions.find((action) => action.id === actionId) ?? null;
}

export function createDemoManifest(now = new Date()): ActionManifest {
  return {
    page_id: "demo-page",
    page_instance_id: "demo-page-tab",
    updated_at: now.toISOString(),
    actions: [
      {
        id: "page.echo",
        title: "Echo",
        description: "Return text from the cloud page runtime.",
        permission: "read",
        input_schema: {
          type: "object",
          properties: {
            text: { type: "string" }
          },
          required: ["text"]
        }
      },
      {
        id: "page.setTitle",
        title: "Set title",
        description: "Update the visible page title.",
        permission: "write",
        input_schema: {
          type: "object",
          properties: {
            title: { type: "string" }
          },
          required: ["title"]
        }
      }
    ]
  };
}

export function envelopeLabel(envelope: BridgeEnvelope): string {
  return `${envelope.source} -> ${envelope.target ?? "all"} / ${envelope.type}`;
}
