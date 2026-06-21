export type ModelProviderDataScope = "providers" | "models" | "all";

export interface ModelProviderDataChangedDetail {
  scope: ModelProviderDataScope;
  provider_id?: string;
}

const MODEL_PROVIDER_DATA_CHANGED_EVENT = "viben:model-provider-data-changed";

export function emitModelProviderDataChanged(detail: ModelProviderDataChangedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MODEL_PROVIDER_DATA_CHANGED_EVENT, { detail }));
}

export function subscribeModelProviderDataChanged(
  listener: (detail: ModelProviderDataChangedDetail) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    listener((event as CustomEvent<ModelProviderDataChangedDetail>).detail);
  };
  window.addEventListener(MODEL_PROVIDER_DATA_CHANGED_EVENT, handler);
  return () => window.removeEventListener(MODEL_PROVIDER_DATA_CHANGED_EVENT, handler);
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
