import type { Yoga } from "yoga-wasm-web";

let _yoga: Yoga | null = null;

export const YogaContext = {
  async init(): Promise<void> {
    if (_yoga) return;
    // Use the auto entry which handles WASM loading for both browser and Node
    const { default: yoga } = await import("yoga-wasm-web/auto");
    _yoga = yoga;
  },

  get instance(): Yoga {
    if (!_yoga) throw new Error("YogaContext not initialized. Call YogaContext.init() first.");
    return _yoga;
  },

  get isReady(): boolean {
    return _yoga !== null;
  },

  reset(): void {
    _yoga = null;
  },
};
