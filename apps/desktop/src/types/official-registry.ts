/**
 * Official MCP Registry Types
 *
 * Based on the official registry API v0.1
 * See: https://registry.modelcontextprotocol.io
 */

// ============================================================================
// Icon Types
// ============================================================================

/**
 * Icon definition for a server
 */
export interface OfficialServerIcon {
  /** URL to the icon image */
  src: string;
  /** MIME type of the icon (e.g., "image/png", "image/svg+xml") */
  mimeType?: string;
  /** Available sizes (e.g., ["32x32", "64x64"]) */
  sizes?: string[];
  /** Theme variant ("light" or "dark") */
  theme?: "light" | "dark";
}

// ============================================================================
// Repository Types
// ============================================================================

/**
 * Repository information for a server
 */
export interface OfficialServerRepository {
  /** Full repository URL */
  url: string;
  /** Source platform (e.g., "github", "gitlab") */
  source: string;
  /** Repository identifier (e.g., "owner/repo") */
  id?: string;
  /** Subfolder within the repository */
  subfolder?: string;
}

// ============================================================================
// Input/Argument Types
// ============================================================================

/**
 * Input field definition for environment variables or arguments
 */
export interface OfficialInput {
  /** Description of the input */
  description?: string;
  /** Whether the input is required */
  isRequired?: boolean;
  /** Format hint for the value */
  format?: "string" | "number" | "boolean" | "filepath";
  /** Default value */
  default?: string;
  /** Placeholder text for UI */
  placeholder?: string;
  /** Whether this is a secret (should be masked) */
  isSecret?: boolean;
  /** Allowed choices for the value */
  choices?: string[];
}

/**
 * Key-value input for environment variables and headers
 */
export interface OfficialKeyValueInput {
  /** The key/name */
  name: string;
  /** Description of the value */
  description?: string;
  /** Whether the value is required */
  isRequired?: boolean;
  /** Default value */
  default?: string;
  /** Whether this is a secret */
  isSecret?: boolean;
  /** Pre-set value */
  value?: string;
}

/**
 * Argument definition for package/runtime arguments
 */
export interface OfficialArgument {
  /** Argument type: positional or named */
  type: "positional" | "named";
  /** Name for named arguments (e.g., "--port") */
  name?: string;
  /** Hint for positional arguments (e.g., "file_path") */
  valueHint?: string;
  /** Description of the argument */
  description?: string;
  /** Whether the argument is required */
  isRequired?: boolean;
  /** Format hint for the value */
  format?: "string" | "number" | "boolean" | "filepath";
  /** Pre-set value */
  value?: string;
  /** Whether this is a secret */
  isSecret?: boolean;
  /** Default value */
  default?: string;
  /** Placeholder text for UI */
  placeholder?: string;
  /** Allowed choices */
  choices?: string[];
  /** Whether the argument can be repeated */
  isRepeated?: boolean;
  /** Variable placeholders within the value */
  variables?: Record<string, OfficialInput>;
}

// ============================================================================
// Transport Types
// ============================================================================

/**
 * Base transport configuration
 */
export interface OfficialTransportBase {
  /** Headers to include in requests */
  headers?: OfficialKeyValueInput[];
}

/**
 * STDIO transport - runs as a subprocess
 */
export interface OfficialStdioTransport {
  type: "stdio";
}

/**
 * SSE transport - Server-Sent Events
 */
export interface OfficialSseTransport extends OfficialTransportBase {
  type: "sse";
  /** URL to connect to */
  url: string;
}

/**
 * Streamable HTTP transport
 */
export interface OfficialStreamableHttpTransport extends OfficialTransportBase {
  type: "streamable-http";
  /** URL to connect to */
  url: string;
}

/**
 * Local transport types (for packages)
 */
export type OfficialLocalTransport =
  | OfficialStdioTransport
  | OfficialSseTransport
  | OfficialStreamableHttpTransport;

/**
 * Remote transport types (for remotes)
 */
export interface OfficialRemoteTransport extends OfficialTransportBase {
  type: "sse" | "streamable-http";
  /** URL to connect to */
  url: string;
  /** Variable placeholders for URL or headers */
  variables?: Record<string, OfficialInput>;
}

// ============================================================================
// Package Types
// ============================================================================

/**
 * Supported package registry types
 */
export type OfficialPackageRegistryType =
  | "npm"
  | "pypi"
  | "oci"
  | "nuget"
  | "mcpb";

/**
 * Package definition - how to install and run the server
 */
export interface OfficialPackage {
  /** Type of package registry */
  registryType: OfficialPackageRegistryType;
  /** Base URL of the registry (if not default) */
  registryBaseUrl?: string;
  /** Package identifier (e.g., "@modelcontextprotocol/server-filesystem") */
  identifier: string;
  /** Package version */
  version?: string;
  /** SHA256 hash for verification */
  fileSha256?: string;
  /** Runtime hint (e.g., "node", "python3") */
  runtimeHint?: string;
  /** Transport configuration */
  transport: OfficialLocalTransport;
  /** Runtime-specific arguments */
  runtimeArguments?: OfficialArgument[];
  /** Package-specific arguments */
  packageArguments?: OfficialArgument[];
  /** Environment variables to set */
  environmentVariables?: OfficialKeyValueInput[];
}

// ============================================================================
// Server Types
// ============================================================================

/**
 * Registry metadata for a published server
 */
export interface OfficialRegistryMeta {
  /** Publication status */
  status: "active" | "deprecated" | "deleted";
  /** When the server was published */
  publishedAt: string;
  /** When the server was last updated */
  updatedAt: string;
  /** Whether this is the latest version */
  isLatest: boolean;
}

/**
 * Full server.json schema
 */
export interface OfficialServerJSON {
  /** JSON schema reference */
  $schema?: string;
  /** Server name (hierarchical, e.g., "io.github.user/server-name") */
  name: string;
  /** Server description */
  description: string;
  /** Display title (friendly name) */
  title?: string;
  /** Semantic version */
  version: string;
  /** Website URL */
  websiteUrl?: string;
  /** Repository information */
  repository?: OfficialServerRepository;
  /** Server icons */
  icons?: OfficialServerIcon[];
  /** Available packages (installation options) */
  packages?: OfficialPackage[];
  /** Remote server endpoints */
  remotes?: OfficialRemoteTransport[];
  /** Extension metadata */
  _meta?: {
    /** Publisher-provided metadata */
    "io.modelcontextprotocol.registry/publisher-provided"?: Record<
      string,
      unknown
    >;
  };
}

/**
 * Server response from the registry API
 */
export interface OfficialServerResponse {
  /** Server definition */
  server: OfficialServerJSON;
  /** Registry metadata */
  _meta: {
    /** Official registry metadata */
    "io.modelcontextprotocol.registry/official"?: OfficialRegistryMeta;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Pagination metadata for list responses
 */
export interface OfficialPaginationMeta {
  /** Cursor for next page */
  nextCursor?: string;
  /** Total count of items */
  count: number;
}

/**
 * Response for listing servers
 */
export interface OfficialServerListResponse {
  /** List of servers */
  servers: OfficialServerResponse[];
  /** Pagination metadata */
  metadata: OfficialPaginationMeta;
}

/**
 * Version list response
 */
export interface OfficialVersionListResponse {
  /** Available versions */
  versions: string[];
}

// ============================================================================
// Transformed Types (for UI)
// ============================================================================

/**
 * Simplified server info for display in UI
 * Transforms official registry format to match existing CloudMcpPackage interface
 */
export interface OfficialServerDisplay {
  /** Server name (used as ID) */
  id: string;
  /** Display name */
  name: string;
  /** Server slug (URL-safe name) */
  slug: string;
  /** Version string */
  version: string;
  /** Description */
  description: string | null;
  /** Primary icon URL */
  iconUrl: string | null;
  /** Repository URL */
  repositoryUrl: string | null;
  /** Website URL */
  websiteUrl: string | null;
  /** Publication status */
  status: "active" | "deprecated" | "deleted";
  /** Whether this is the latest version */
  isLatest: boolean;
  /** Published timestamp */
  publishedAt: string;
  /** Updated timestamp */
  updatedAt: string;
  /** Available package types */
  packageTypes: OfficialPackageRegistryType[];
  /** Has remote endpoints */
  hasRemotes: boolean;
  /** Original server data for installation */
  _original: OfficialServerResponse;
}

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Cache entry for server list
 */
export interface OfficialRegistryCacheEntry<T> {
  /** Cached data */
  data: T;
  /** Cache timestamp */
  cachedAt: number;
  /** Time-to-live in milliseconds */
  ttl: number;
}

/**
 * Cache keys for the registry
 */
export type OfficialRegistryCacheKey =
  | `servers_${string}` // servers_<cursor>_<search>
  | `server_${string}` // server_<name>_<version>
  | `versions_${string}`; // versions_<name>
