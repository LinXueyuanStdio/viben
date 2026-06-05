export const NEW_TAB_REQUEST_PARAM = "viben_new_tab";

export function withNewTabRequest(url: string): string {
  const hashIndex = url.indexOf("#");
  const pathAndSearch = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
  const queryIndex = pathAndSearch.indexOf("?");
  const path = queryIndex >= 0 ? pathAndSearch.slice(0, queryIndex) : pathAndSearch;
  const search = queryIndex >= 0 ? pathAndSearch.slice(queryIndex + 1) : "";
  const params = new URLSearchParams(search);

  params.set(NEW_TAB_REQUEST_PARAM, "1");

  const nextSearch = params.toString();
  return `${path}${nextSearch ? `?${nextSearch}` : ""}${hash}`;
}

export function hasNewTabRequest(search: string): boolean {
  return new URLSearchParams(search).get(NEW_TAB_REQUEST_PARAM) === "1";
}

export function withoutNewTabRequest(url: string): string {
  const hashIndex = url.indexOf("#");
  const pathAndSearch = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
  const queryIndex = pathAndSearch.indexOf("?");

  if (queryIndex < 0) {
    return url;
  }

  const path = pathAndSearch.slice(0, queryIndex);
  const params = new URLSearchParams(pathAndSearch.slice(queryIndex + 1));
  params.delete(NEW_TAB_REQUEST_PARAM);

  const nextSearch = params.toString();
  return `${path}${nextSearch ? `?${nextSearch}` : ""}${hash}`;
}
