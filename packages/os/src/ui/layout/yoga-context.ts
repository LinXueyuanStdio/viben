import type { Yoga } from "yoga-wasm-web";

let _yoga: Yoga | null = null;
let _initPromise: Promise<void> | null = null;

export const YogaContext = {
  init(): Promise<void> {
    if (_yoga) return Promise.resolve();
    if (_initPromise) return _initPromise;
    _initPromise = import("yoga-wasm-web/auto").then(({ default: yoga }) => {
      _yoga = yoga;
    });
    return _initPromise;
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
    _initPromise = null;
  },
};
