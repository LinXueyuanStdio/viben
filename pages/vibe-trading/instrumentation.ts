export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getWsServer } = await import("./lib/ws-server");
    getWsServer();
  }
}
