import { BaseComponent } from "./base-component";
import { Box } from "../primitives/box";
import { darkTheme } from "../theme";
import type { Theme } from "../theme";

export interface ModalConfig {
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  theme?: Theme;
}

export class Modal extends BaseComponent {
  private _backdrop: Box;
  private _panel: Box;
  private _visible = false;

  constructor(config: ModalConfig) {
    super();
    const theme = config.theme ?? darkTheme;
    this._backdrop = new Box({ width: config.viewportWidth, height: config.viewportHeight, backgroundColor: "#000000" });
    this._backdrop.setBackgroundColor("#000000", 0.4);
    this._panel = new Box({ width: config.width, height: config.height, radius: theme.radii.lg, backgroundColor: theme.colors.surface });
    this._panel.mesh.position.z = 0.1;
    this.root.add(this._backdrop.mesh);
    this.root.add(this._panel.mesh);
    this.root.visible = false;
  }

  get panelMesh() { return this._panel.mesh; }
  get visible(): boolean { return this._visible; }

  show(): void { this._visible = true; this.root.visible = true; }
  hide(): void { this._visible = false; this.root.visible = false; }

  dispose(): void { this._backdrop.dispose(); this._panel.dispose(); this._disposed = true; }
}
