/**
 * Files Module
 * 文件操作模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type {
  FileEntry,
  FileListResponse,
  FileContentResponse,
  McpServersConfig,
} from "../types";

// ============================================================================
// File Operations
// ============================================================================

/**
 * List directory contents
 */
export async function listFiles(
  baseUrl: string,
  path: string,
  showHidden = false
): Promise<FileListResponse> {
  const params = new URLSearchParams();
  params.set("path", path);
  if (showHidden) params.set("show_hidden", "true");

  const response = await fetch(
    `${baseUrl}/api/files/list?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list files: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Read file content
 */
export async function readFile(
  baseUrl: string,
  path: string,
  encoding = "utf-8"
): Promise<FileContentResponse> {
  const params = new URLSearchParams();
  params.set("path", path);
  params.set("encoding", encoding);

  const response = await fetch(
    `${baseUrl}/api/files/content?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to read file: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Create a new file
 */
export async function createFile(
  baseUrl: string,
  path: string,
  content = "",
  encoding = "utf-8"
): Promise<FileEntry> {
  const response = await fetch(`${baseUrl}/api/files`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ path, content, encoding }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to create file: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Create a new directory
 */
export async function createDirectory(
  baseUrl: string,
  path: string,
  recursive = true
): Promise<FileEntry> {
  const response = await fetch(`${baseUrl}/api/files/directory`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ path, recursive }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to create directory: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Write content to file
 */
export async function writeFile(
  baseUrl: string,
  path: string,
  content: string,
  encoding = "utf-8"
): Promise<{ success: boolean; file: FileEntry }> {
  const response = await fetch(`${baseUrl}/api/files/content`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ path, content, encoding }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to write file: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Delete file or directory
 */
export async function deleteFile(
  baseUrl: string,
  path: string,
  recursive = false
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/files`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ path, recursive }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to delete file: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Rename file or directory
 */
export async function renameFile(
  baseUrl: string,
  oldPath: string,
  newPath: string
): Promise<{ success: boolean; file: FileEntry }> {
  const response = await fetch(`${baseUrl}/api/files/rename`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to rename file: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Copy file or directory
 */
export async function copyFile(
  baseUrl: string,
  source: string,
  destination: string,
  recursive = true
): Promise<{ success: boolean; file: FileEntry }> {
  const response = await fetch(`${baseUrl}/api/files/copy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ source, destination, recursive }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to copy file: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Move file or directory
 */
export async function moveFile(
  baseUrl: string,
  source: string,
  destination: string
): Promise<{ success: boolean; file: FileEntry }> {
  const response = await fetch(`${baseUrl}/api/files/move`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ source, destination }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to move file: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Open file with system default or specific app
 */
export async function openFile(
  baseUrl: string,
  path: string,
  appId?: string
): Promise<{ success: boolean; path: string }> {
  const response = await fetch(`${baseUrl}/api/files/open`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ path, app_id: appId }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to open file: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Reveal file in system file manager
 */
export async function revealFile(
  baseUrl: string,
  path: string
): Promise<{ success: boolean; path: string }> {
  const response = await fetch(`${baseUrl}/api/files/reveal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ path }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to reveal file: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

// ============================================================================
// File Browser
// ============================================================================

/**
 * Open a folder in file manager
 */
export async function openFolder(
  baseUrl: string,
  folderPath: string
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/files/open-folder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ path: folderPath }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to open folder: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Reveal a file/folder in file manager
 */
export async function revealInFileManager(
  baseUrl: string,
  targetPath: string
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/files/reveal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ path: targetPath }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to reveal in file manager: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Read directory contents
 */
export async function readDirectory(
  baseUrl: string,
  workspacePath: string,
  dirPath?: string
): Promise<FileEntry[]> {
  const params = new URLSearchParams();
  params.set("workspace_path", workspacePath);
  if (dirPath) params.set("dir_path", dirPath);

  const response = await fetch(
    `${baseUrl}/api/files/directory?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to read directory: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Read file content
 */
export async function readFileContent(
  baseUrl: string,
  workspacePath: string,
  filePath: string,
  maxSize?: number
): Promise<string> {
  const params = new URLSearchParams();
  params.set("workspace_path", workspacePath);
  params.set("file_path", filePath);
  if (maxSize) params.set("max_size", String(maxSize));

  const response = await fetch(
    `${baseUrl}/api/files/content?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to read file content: ${errorMessage}`,
      response.status
    );
  }

  const data = await response.json();
  return data.content;
}

/**
 * Read MCP servers config file
 */
export async function readMcpServersFile(
  baseUrl: string
): Promise<McpServersConfig> {
  // Log call stack for debugging frequent requests
  console.log("[API] readMcpServersFile called", new Error().stack?.split("\n").slice(1, 5).join("\n"));

  const response = await fetch(`${baseUrl}/api/files/mcp-servers`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to read MCP servers file: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Write MCP servers config file
 */
export async function writeMcpServersFile(
  baseUrl: string,
  config: McpServersConfig
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/files/mcp-servers`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to write MCP servers file: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * Get config directory path
 */
export async function getConfigDir(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/files/config-dir`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get config dir: ${errorMessage}`,
      response.status
    );
  }

  const data = await response.json();
  return data.path;
}
