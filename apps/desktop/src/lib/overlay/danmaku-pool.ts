import { Graphics } from "pixi.js";
import { PERFORMANCE_LIMITS } from "./constants";

export class DanmakuPool {
  private pool: Graphics[] = [];
  private maxSize: number;

  constructor(maxSize: number = PERFORMANCE_LIMITS.danmakuPoolSize) {
    this.maxSize = maxSize;
    for (let i = 0; i < maxSize / 2; i++) {
      this.pool.push(new Graphics());
    }
  }

  acquire(): Graphics {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return new Graphics();
  }

  release(item: Graphics): void {
    item.clear();
    item.visible = false;
    if (this.pool.length < this.maxSize) {
      this.pool.push(item);
    } else {
      item.destroy();
    }
  }

  get size(): number {
    return this.pool.length;
  }

  destroy(): void {
    this.pool.forEach((item) => item.destroy());
    this.pool = [];
  }
}
