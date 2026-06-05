export const constants = {};

export function gunzipSync(): never {
  throw new Error("node:zlib not available in browser");
}

export function gzipSync(): never {
  throw new Error("node:zlib not available in browser");
}
