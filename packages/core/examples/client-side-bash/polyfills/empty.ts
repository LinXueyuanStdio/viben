export const constants = {
  Z_BEST_COMPRESSION: 9,
  Z_BEST_SPEED: 1,
  Z_DEFAULT_COMPRESSION: -1,
};

function unsupportedZlib(): never {
  throw new Error("gzip and gunzip are not supported in the browser demo");
}

export function gzipSync(): never {
  return unsupportedZlib();
}

export function gunzipSync(): never {
  return unsupportedZlib();
}
