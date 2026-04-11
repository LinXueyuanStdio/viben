import { Group } from "three";

export abstract class BaseComponent {
  readonly root = new Group();
  protected _disposed = false;

  abstract dispose(): void;

  setPosition(x: number, y: number): void {
    this.root.position.set(x, y, 0);
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
  }
}
