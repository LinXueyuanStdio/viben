import { useMemo } from "react";
import { nanoid } from "nanoid";
import { useActionProvider } from "@/hooks/use-action-provider";
import { useOverlayStore } from "@/stores/overlay-store";
import {
  registerCompletionCallback,
  removeCompletionCallback,
  compilePresentationCommands,
} from "@viben/presentation";
import type { ClientToolResult, PresentationToolName } from "@viben/presentation";
import type { ExecutionContext } from "@/lib/action-system/types";

/**
 * Registers presentation actions under the "presentation" namespace.
 * This enables GUI_execute("presentation.draw", { commands: [...] }) etc.
 *
 * Mount at app root level (always available).
 */
export function PresentationActionProvider() {
  const actions = useMemo(() => ({
    draw: {
      description: "Draw shapes on the canvas (arrows, highlights, circles, text, lines, etc.). Pass a commands array.",
      input_schema: {
        type: "object",
        properties: {
          commands: {
            type: "array",
            description: "Drawing command sequence",
            items: { type: "object" },
          },
        },
        required: ["commands"],
      },
      execute: (payload: unknown, ctx: ExecutionContext) =>
        executePresentationAction("presentation_draw", payload, ctx),
    },
    spotlight: {
      description: "Highlight a UI region with an optional short description.",
      input_schema: {
        type: "object",
        properties: {
          target: { type: "object", description: "Target region {x, y, width, height}" },
          title: { type: "string" },
          description: { type: "string" },
        },
        required: ["target"],
      },
      execute: (payload: unknown, ctx: ExecutionContext) =>
        executePresentationAction("presentation_spotlight", payload, ctx),
    },
    callout: {
      description: "Add an arrowed callout annotation to a UI region.",
      input_schema: {
        type: "object",
        properties: {
          target: { type: "object", description: "Target region" },
          from: { type: "object", description: "Arrow start point" },
          label: { type: "string", description: "Label text" },
        },
        required: ["target", "from", "label"],
      },
      execute: (payload: unknown, ctx: ExecutionContext) =>
        executePresentationAction("presentation_callout", payload, ctx),
    },
    walkthrough: {
      description: "Walk through multiple UI regions step-by-step.",
      input_schema: {
        type: "object",
        properties: {
          steps: { type: "array", description: "Steps array", items: { type: "object" } },
        },
        required: ["steps"],
      },
      execute: (payload: unknown, ctx: ExecutionContext) =>
        executePresentationAction("presentation_walkthrough", payload, ctx),
    },
    compare: {
      description: "Compare two UI regions side-by-side with labels.",
      input_schema: {
        type: "object",
        properties: {
          left: { type: "object", description: "Left region configuration" },
          right: { type: "object", description: "Right region configuration" },
        },
        required: ["left", "right"],
      },
      execute: (payload: unknown, ctx: ExecutionContext) =>
        executePresentationAction("presentation_compare", payload, ctx),
    },
    clear: {
      description: "Clear all annotations from the presentation canvas.",
      input_schema: { type: "object", properties: {} },
      execute: async (): Promise<ClientToolResult> => {
        const store = useOverlayStore.getState();
        if (store.presentationActive) {
          store.actions.addPresentationSteps({
            toolUseId: nanoid(),
            toolName: "presentation_clear",
            toolInput: {},
            commands: [{ type: "clear" }],
          });
        }
        return { content: [{ type: "text", text: "Presentation canvas cleared." }] };
      },
    },
    stop: {
      description: "Exit presentation mode, clearing canvas and hiding overlay.",
      input_schema: { type: "object", properties: {} },
      execute: async (): Promise<ClientToolResult> => {
        const store = useOverlayStore.getState();
        if (store.presentationActive) {
          store.actions.stopPresentation();
        }
        return { content: [{ type: "text", text: "Presentation mode stopped." }] };
      },
    },
  }), []);

  useActionProvider("presentation", actions);
  return null;
}

// ============================================================================
// Helper: Execute a presentation action with async completion
// ============================================================================

/**
 * Timeout for waiting on presentation completion (matches the backend's 60s for GUI_execute).
 * Slightly less to ensure we respond before the backend times out.
 */
const PRESENTATION_ACTION_TIMEOUT_MS = 55_000;

async function executePresentationAction(
  toolName: PresentationToolName,
  payload: unknown,
  ctx: ExecutionContext
): Promise<ClientToolResult> {
  const store = useOverlayStore.getState();
  const toolInput = (payload as Record<string, unknown>) || {};
  const toolUseId = nanoid();

  const commands = compilePresentationCommands(toolName, toolInput);
  if (commands.length === 0) {
    return {
      content: [{ type: "text", text: "No valid commands produced from input." }],
      isError: true,
    };
  }

  // Start presentation if not active
  if (!store.presentationActive) {
    store.actions.startPresentation(ctx.sessionId);
  }

  // Register completion callback and create a promise
  const resultPromise = new Promise<ClientToolResult>((resolve) => {
    const timer = setTimeout(() => {
      removeCompletionCallback(toolUseId);
      resolve({
        content: [{ type: "text", text: "Presentation action timed out waiting for completion." }],
        isError: true,
      });
    }, PRESENTATION_ACTION_TIMEOUT_MS);

    registerCompletionCallback(toolUseId, (result) => {
      clearTimeout(timer);
      resolve(result);
    });
  });

  // Dispatch commands to overlay store
  store.actions.addPresentationSteps({
    toolUseId,
    toolName,
    toolInput,
    commands,
  });

  // Mark stream done for this group so autoFinish triggers
  store.actions.markPresentationStreamDone();

  return resultPromise;
}
