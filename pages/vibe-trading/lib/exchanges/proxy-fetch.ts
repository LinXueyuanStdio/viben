import https from "node:https";
import http from "node:http";
import { HttpsProxyAgent } from "https-proxy-agent";

const proxyUrl =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy;

const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

export async function proxyFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  if (!agent) {
    return fetch(url, init);
  }

  return new Promise<Response>((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const mod = isHttps ? https : http;

    const headers: Record<string, string> = {};
    if (init?.headers) {
      const h = init.headers;
      if (h instanceof Headers) {
        h.forEach((v, k) => { headers[k] = v; });
      } else if (Array.isArray(h)) {
        for (const [k, v] of h) { headers[k] = v; }
      } else {
        Object.assign(headers, h);
      }
    }

    const req = mod.request(
      url,
      {
        method: init?.method ?? "GET",
        headers,
        agent,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          const responseHeaders = new Headers();
          for (const [key, val] of Object.entries(res.headers)) {
            if (val) responseHeaders.set(key, Array.isArray(val) ? val.join(", ") : val);
          }
          resolve(
            new Response(body, {
              status: res.statusCode ?? 200,
              statusText: res.statusMessage ?? "",
              headers: responseHeaders,
            })
          );
        });
        res.on("error", reject);
      }
    );

    req.on("error", reject);

    if (init?.body) {
      req.write(init.body);
    }
    req.end();
  });
}
