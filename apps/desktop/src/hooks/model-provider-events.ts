export type ModelProviderDataScope = "providers" | "models" | "all";

export interface ModelProviderDataChangedDetail {
  scope: ModelProviderDataScope;
  provider_id?: string;
}

const MODEL_PROVIDER_DATA_CHANGED_EVENT = "viben:model-provider-data-changed";
const fallbackTarget = typeof EventTarget === "undefined" ? null : new EventTarget();

function getEventTarget(): EventTarget | null {
  if (typeof window !== "undefined") return window;
  return fallbackTarget;
}

function createModelProviderEvent(detail: ModelProviderDataChangedDetail): Event {
  if (typeof CustomEvent !== "undefined") {
    return new CustomEvent(MODEL_PROVIDER_DATA_CHANGED_EVENT, { detail });
  }

  const event = new Event(MODEL_PROVIDER_DATA_CHANGED_EVENT) as Event & {
    detail: ModelProviderDataChangedDetail;
  };
  event.detail = detail;
  return event;
}

export function emitModelProviderDataChanged(detail: ModelProviderDataChangedDetail): void {
  getEventTarget()?.dispatchEvent(createModelProviderEvent(detail));
}

export function subscribeModelProviderDataChanged(
  listener: (detail: ModelProviderDataChangedDetail) => void
): () => void {
  const target = getEventTarget();
  if (!target) return () => {};
  const handler = (event: Event) => {
    listener((event as CustomEvent<ModelProviderDataChangedDetail>).detail);
  };
  target.addEventListener(MODEL_PROVIDER_DATA_CHANGED_EVENT, handler);
  return () => target.removeEventListener(MODEL_PROVIDER_DATA_CHANGED_EVENT, handler);
}

export function shouldRefreshProviderList(detail: ModelProviderDataChangedDetail): boolean {
  return detail.scope === "providers" || detail.scope === "all";
}

export function shouldRefreshModelList(
  detail: ModelProviderDataChangedDetail,
  provider_id?: string | null
): boolean {
  if (detail.scope === "providers") return false;
  if (!detail.provider_id || !provider_id) return true;
  return detail.provider_id === provider_id;
}
