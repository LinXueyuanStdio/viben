import { summarizeActionManifest } from "./business.js";
import type { ActionDescriptor, ActionManifest } from "@viben/protocol";

export interface ActionManifestPanelProps {
  manifest: ActionManifest;
  selectedActionId?: string | null;
  onSelectAction?: (action: ActionDescriptor) => void;
}

export function ActionManifestPanel({
  manifest,
  selectedActionId,
  onSelectAction
}: ActionManifestPanelProps) {
  const summary = summarizeActionManifest(manifest);

  return (
    <section className="viben-action-manifest-panel">
      <header className="viben-action-manifest-panel__header">
        <div>
          <p className="viben-action-manifest-panel__eyebrow">Cloud page actions</p>
          <h2>{manifest.page_id}</h2>
        </div>
        <div className="viben-action-manifest-panel__summary">
          <span>{summary.actionCount} actions</span>
          <span>{summary.highestPermission ?? "none"}</span>
        </div>
      </header>

      <div className="viben-action-manifest-panel__list">
        {manifest.actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className={
              selectedActionId === action.id
                ? "viben-action-manifest-panel__action is-selected"
                : "viben-action-manifest-panel__action"
            }
            onClick={() => onSelectAction?.(action)}
          >
            <span>
              <strong>{action.title}</strong>
              <small>{action.id}</small>
            </span>
            <em>{action.permission}</em>
          </button>
        ))}
      </div>
    </section>
  );
}
