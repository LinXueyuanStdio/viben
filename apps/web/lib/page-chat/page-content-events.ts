export const PAGE_CONTENT_CHANGED_EVENT = "viben:page-content-changed";

export type PageContentChangedDetail = {
  publishedPageId: string;
  chatId: string;
};

export function emitPageContentChanged(detail: PageContentChangedDetail): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<PageContentChangedDetail>(PAGE_CONTENT_CHANGED_EVENT, {
      detail,
    }),
  );
}

export function subscribePageContentChanged(
  listener: (detail: PageContentChangedDetail) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = (event: Event) => {
    listener((event as CustomEvent<PageContentChangedDetail>).detail);
  };

  window.addEventListener(PAGE_CONTENT_CHANGED_EVENT, handler);
  return () => {
    window.removeEventListener(PAGE_CONTENT_CHANGED_EVENT, handler);
  };
}
