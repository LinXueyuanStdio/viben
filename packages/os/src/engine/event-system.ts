import { Object3D, Raycaster, Vector2, OrthographicCamera, Scene } from "three";
import type { UIEvent, PointerEventData } from "../types";

type UIEventHandler = (event: UIEvent) => void;

export class EventSystem {
  private _handlers = new Map<Object3D, Map<string, UIEventHandler[]>>();
  private _raycaster = new Raycaster();
  private _ndc = new Vector2();

  on(object: Object3D, eventType: string, handler: UIEventHandler): void {
    if (!this._handlers.has(object)) this._handlers.set(object, new Map());
    const objMap = this._handlers.get(object)!;
    if (!objMap.has(eventType)) objMap.set(eventType, []);
    objMap.get(eventType)!.push(handler);
  }

  off(object: Object3D, eventType: string, handler: UIEventHandler): void {
    const list = this._handlers.get(object)?.get(eventType);
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx !== -1) list.splice(idx, 1);
  }

  dispatch(target: Object3D, eventType: string, pointer: PointerEventData | null): void {
    const path: Object3D[] = [];
    let current: Object3D | null = target;
    while (current) { path.push(current); current = current.parent; }

    const event: UIEvent = {
      type: eventType, target, currentTarget: target, pointer, stopped: false,
      stopPropagation() { this.stopped = true; },
    };

    for (const obj of path) {
      if (event.stopped) break;
      event.currentTarget = obj;
      const handlers = this._handlers.get(obj)?.get(eventType);
      if (handlers) { for (const h of handlers) { h(event); if (event.stopped) break; } }
    }
  }

  hitTest(screenX: number, screenY: number, canvasWidth: number, canvasHeight: number, camera: OrthographicCamera, scene: Scene): Object3D | null {
    this._ndc.x = (screenX / canvasWidth) * 2 - 1;
    this._ndc.y = -(screenY / canvasHeight) * 2 + 1;
    this._raycaster.setFromCamera(this._ndc, camera);
    const intersects = this._raycaster.intersectObjects(scene.children, true);
    for (const hit of intersects) { if (hit.object.userData.interactive) return hit.object; }
    return null;
  }

  dispose(): void { this._handlers.clear(); }
}
