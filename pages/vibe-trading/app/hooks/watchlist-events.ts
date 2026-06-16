type Listener = () => void;

const listeners = new Set<Listener>();

export const watchlistEvents = {
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
  emit() {
    listeners.forEach((fn) => fn());
  },
};
