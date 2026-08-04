/**
 * Auto-generate operationId and tags from HTTP method + URL path.
 *
 * Used by the @fastify/swagger transform to inject operationId into every route.
 * The generated operationId + tag produce clean SDK method names like:
 *
 *   client.agent.list()              // GET  /api/agent
 *   client.agent.create()            // POST /api/agent
 *   client.agent.get()               // GET  /api/agent/:id
 *   client.agent.listSessions()      // GET  /api/agent/:id/sessions
 *   client.agent.createSession()     // POST /api/agent/:id/sessions
 *   client.github.getIssueComments() // GET  /api/github/issues/:number/comments
 */

// ============================================================================
// Configuration
// ============================================================================

/** HTTP method → default CRUD action. */
const METHOD_ACTION: Record<string, string> = {
  GET: "list",
  POST: "create",
  PUT: "update",
  PATCH: "update",
  DELETE: "delete",
};

/**
 * URL segments recognized as action verbs (non-CRUD).
 * When the last resource segment matches, it becomes the operationId action.
 */
const ACTION_VERBS = new Set([
  "promote", "demote", "instantiate", "install", "uninstall",
  "enable", "disable", "reload", "refresh", "validate",
  "investigate", "analyze", "triage", "cluster",
  "approve", "reject", "retry", "cancel", "archive",
  "import", "export", "detect", "discover", "search",
  "send", "test", "check", "verify", "cleanup", "clean",
  "start", "stop", "pause", "resume", "restart",
  "enqueue", "dequeue", "execute", "run",
  "upload", "download", "connect", "disconnect",
  "subscribe", "unsubscribe",
  "add", "remove", "clear", "reset",
  "open", "close", "reveal", "copy", "move", "rename",
  "set", "apply", "generate", "compute", "select",
  "init", "kill",
  "view", "show", "list",
  "serve", "reorder", "duplicate",
]);

// ============================================================================
// Helpers
// ============================================================================

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Normalize a path segment: strip file extension, hyphens/underscores → camelCase. */
function segmentToCamel(seg: string): string {
  // Strip known file extensions
  const cleaned = seg.replace(/\.(js|ts|json|yaml|yml|css|html|md|txt)$/, "");
  return cleaned
    .replace(/[_-]+/g, "-")
    .split("-")
    .map((p, i) => (i === 0 ? p : capitalize(p)))
    .join("");
}

/** Singularize a resource name (simple heuristic + known exceptions). */
function singularize(word: string): string {
  // Known irregulars
  const known: Record<string, string> = {
    "aliases": "alias",
    "releases": "release",
    "preferences": "preference",
    "devices": "device",
    "accounts": "account",
    "sessions": "session",
    "messages": "message",
    "comments": "comment",
    "reactions": "reaction",
    "activities": "activity",
    "categories": "category",
    "sources": "source",
    "packages": "package",
    "events": "event",
    "patches": "patch",
    "peers": "peer",
    "agents": "agent",
    "tasks": "task",
    "notifications": "notification",
    "endpoints": "endpoint",
    "histories": "history",
    "indices": "index",
    "processes": "process",
    "statuses": "status",
  };
  if (known[word]) return known[word];
  if (word.endsWith("ss")) return word;          // status, address
  if (word.endsWith("ies")) return word.slice(0, -3) + "y"; // categories → category
  if (word.endsWith("ses") || word.endsWith("xes") || word.endsWith("ches") || word.endsWith("shes") || word.endsWith("zes")) {
    return word.slice(0, -2);                    // cases → case, boxes → box
  }
  if (word.endsWith("s") && word.length > 2) {
    return word.slice(0, -1);                    // agents → agent
  }
  return word;
}

/** Check if a path segment is a param placeholder (`:id` or `{id}`). */
function isParam(seg: string): boolean {
  return seg.startsWith(":") || seg.startsWith("{");
}

/** Whether an action is a standard CRUD verb (not a custom verb from the URL). */
function isCrudAction(action: string): boolean {
  return ["list", "get", "create", "update", "delete"].includes(action);
}

/** URL patterns that are singleton endpoints (not collections). */
const SINGLETON_PATTERNS: RegExp[] = [
  /^\/health$/,
  /^\/openapi\.(json|yaml)$/,
];

/**
 * Sub-resource names that represent singleton concepts (NOT collections).
 * When the last resource segment matches one of these and there's no param,
 * GET uses "get" instead of "list".
 */
const SINGLETON_SUB_RESOURCES = new Set([
  "default",
  "status",
  "config",
  "settings",
  "info",
  "health",
  "summary",
  "overview",
  "profile",
  "latest",
  "current",
  "running",
  "available",
  "qr",
  "dir",
  "git-status",
  "gitStatus",
  "token",
  "community",
]);

// ============================================================================
// Public API
// ============================================================================

export interface OperationIdResult {
  /** Globally unique operationId: `{tag}_{cleanName}`. */
  operationId: string;
  /** Clean SDK method name (no tag prefix, no counter). */
  methodName: string;
  tags: string[];
}

/**
 * Generate operationId and tags from HTTP method and URL.
 *
 * ## Format
 *
 * ```
 * operationId = {action}[Detail]
 * ```
 *
 * - **action**: from HTTP method, or from URL verb segment
 * - **Detail**: remaining resource segments (beyond the first), singularized + camelCase
 * - **tag**: first resource segment, camelCase
 *
 * ## Examples
 *
 * | Method | URL | operationId | tag |
 * |--------|-----|-------------|-----|
 * | GET | /api/agent | list | agent |
 * | POST | /api/agent | create | agent |
 * | GET | /api/agent/:id | get | agent |
 * | PATCH | /api/agent/:id | update | agent |
 * | DELETE | /api/agent/:id | delete | agent |
 * | GET | /api/agent/:id/sessions | listSessions | agent |
 * | POST | /api/agent/:id/sessions | createSession | agent |
 * | GET | /api/agent/:id/sessions/:sid | getSession | agent |
 * | GET | /api/agent/:id/sessions/:sid/messages | getSessionMessages | agent |
 * | POST | /api/agent/:id/promote | promote | agent |
 * | POST | /api/agent/templates/:id/instantiate | instantiateTemplate | agent |
 * | GET | /api/github/issues/:number/comments | getIssueComments | github |
 * | POST | /api/skill/install | install | skill |
 * | GET | /health | get | health |
 */
/**
 * Create a generator with collision tracking.
 *
 * Generates globally unique operationIds by prefixing with the tag,
 * and clean SDK method names (without the tag prefix) via `x-speakeasy-method-name`.
 */
export function createOperationIdGenerator(): (method: string, url: string) => OperationIdResult {
  const seenGlobal = new Set<string>();

  return function generateOperationId(
    method: string,
    url: string,
  ): OperationIdResult {
  // Strip /api/ or leading /
  let path = url;
  if (path.startsWith("/api/")) {
    path = path.slice(5);
  } else if (path.startsWith("/")) {
    path = path.slice(1);
  }
  path = path.replace(/\/$/, "");

  const rawSegments = path.split("/").filter((s) => s.length > 0);
  const resourceSegments = rawSegments.filter((s) => !isParam(s));

  if (resourceSegments.length === 0) {
    return {
      operationId: METHOD_ACTION[method.toUpperCase()] ?? method.toLowerCase(),
      tags: ["root"],
    };
  }

  // ---- Tag: first resource segment ----
  const tag = segmentToCamel(resourceSegments[0]);

  // ---- Detect singleton endpoints ----
  const isSingleton = resourceSegments.length <= 1 &&
    SINGLETON_PATTERNS.some((p) => p.test(url));

  // ---- Determine action ----
  const upperMethod = method.toUpperCase();
  const lastResource = resourceSegments[resourceSegments.length - 1];
  const lastRaw = rawSegments[rawSegments.length - 1];
  const endsWithParam = isParam(lastRaw);

  // Check if the path has a param BEFORE the last resource segment.
  // If so, the last resource is a sub-collection being accessed in the context of
  // a parent entity → use "get" for the sub-collection, not "list".
  const hasParamBeforeLast = (() => {
    if (resourceSegments.length < 2) return false;
    // Find the last resource segment in rawSegments and check if any param precedes it
    const lastResIdx = rawSegments.lastIndexOf(lastResource);
    return rawSegments.slice(0, lastResIdx).some(isParam);
  })();

  // Detect file download: last segment contains a dot (e.g., .js, .css, .json)
  const isFileDownload = lastResource.includes(".");

  // Detect singleton sub-resource: GET with no params but last segment is a singleton concept
  const isSingletonSubResource = upperMethod === "GET" && !endsWithParam &&
    !hasParamBeforeLast && resourceSegments.length > 1 &&
    SINGLETON_SUB_RESOURCES.has(lastResource.toLowerCase());

  let action: string;
  let detailSegments: string[]; // resource segments AFTER the first one, minus verb

  if (ACTION_VERBS.has(lastResource.toLowerCase())) {
    // URL ends with an action verb
    action = lastResource.toLowerCase();
    detailSegments = resourceSegments.slice(1, -1);
  } else if (upperMethod === "GET" && isSingleton) {
    // Singleton endpoint (e.g., /health, /openapi.json)
    action = "get";
    detailSegments = resourceSegments.slice(1);
  } else if (upperMethod === "GET" && endsWithParam) {
    action = "get";
    detailSegments = resourceSegments.slice(1);
  } else if (upperMethod === "GET" && hasParamBeforeLast) {
    // GET with parent param context → "get" sub-collection
    action = "get";
    detailSegments = resourceSegments.slice(1);
  } else if (upperMethod === "GET" && isSingletonSubResource) {
    // GET on a singleton sub-resource → "get"
    action = "get";
    detailSegments = resourceSegments.slice(1);
  } else if (upperMethod === "GET" && isFileDownload) {
    // GET on a file-like URL → "get"
    action = "get";
    detailSegments = resourceSegments.slice(1);
  } else if (upperMethod === "GET" && !endsWithParam) {
    action = "list";
    detailSegments = resourceSegments.slice(1);
  } else {
    action = METHOD_ACTION[upperMethod] ?? upperMethod.toLowerCase();
    detailSegments = resourceSegments.slice(1);
  }

  // ---- Build detail suffix ----
  const isListAction = action === "list";
  const keepLastPlural = ["list", "get", "delete"].includes(action);
  let suffix = "";

  if (detailSegments.length > 0) {
    suffix = detailSegments
      .map((s, i) => {
        const camel = segmentToCamel(s);
        const isLast = i === detailSegments.length - 1;

        if (isListAction) {
          return capitalize(camel);
        }
        if (keepLastPlural) {
          if (isLast && !endsWithParam) {
            return capitalize(camel); // keep plural
          }
          return capitalize(singularize(camel));
        }
        // create/update: singularize all
        return capitalize(singularize(camel));
      })
      .join("");
  }

  const methodName = action + suffix;

  // Globally unique operationId: `{tag}_{methodName}`
  let operationId = `${tag}_${methodName}`;
  if (seenGlobal.has(operationId)) {
    let n = 2;
    while (seenGlobal.has(`${operationId}_${n}`)) n++;
    operationId = `${operationId}_${n}`;
  }
  seenGlobal.add(operationId);

  return { operationId, methodName, tags: [tag] };
  };
}

/**
 * Simple stateless generator (for testing).
 */
export function generateOperationId(
  method: string,
  url: string,
): OperationIdResult {
  return createOperationIdGenerator()(method, url);
}
