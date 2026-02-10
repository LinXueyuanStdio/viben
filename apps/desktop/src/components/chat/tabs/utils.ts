/**
 * Utility functions for sidebar tabs
 */
import {
  FileText,
  Folder,
  FileCode,
  FileJson,
  ImageIcon,
  Table,
  Presentation,
  FileSpreadsheet,
  Music,
  Video,
  Type as TypeIcon,
  File,
  Terminal,
  Search,
  FolderSearch,
  Globe,
  ListTodo,
  Layers,
  Code2,
  FileEdit,
  Wrench,
} from "lucide-react";
import type { ArtifactType, AgentMessage, ToolUsage } from "@/types";
import type { SkillInfo } from "./types";

/**
 * Get icon for file based on extension
 */
export function getFileIconByExt(ext?: string) {
  if (!ext) return File;
  switch (ext.toLowerCase()) {
    case "html":
    case "htm":
      return FileCode;
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
      return FileCode;
    case "css":
    case "scss":
    case "less":
      return FileCode;
    case "json":
      return FileJson;
    case "md":
    case "markdown":
      return FileText;
    case "csv":
      return Table;
    case "xlsx":
    case "xls":
      return FileSpreadsheet;
    case "pptx":
    case "ppt":
      return Presentation;
    case "docx":
    case "doc":
      return FileText;
    case "pdf":
      return FileText;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
    case "bmp":
    case "ico":
      return ImageIcon;
    case "mp3":
    case "wav":
    case "ogg":
    case "m4a":
    case "aac":
    case "flac":
      return Music;
    case "mp4":
    case "webm":
    case "mov":
    case "avi":
    case "mkv":
      return Video;
    case "ttf":
    case "otf":
    case "woff":
    case "woff2":
      return TypeIcon;
    case "py":
    case "rb":
    case "go":
    case "rs":
    case "java":
    case "c":
    case "cpp":
    case "h":
      return FileCode;
    default:
      return File;
  }
}

/**
 * Get tool icon based on tool name
 */
export function getToolIcon(toolName: string) {
  // Handle MCP tools (mcp__server__tool format)
  const baseName = toolName.startsWith("mcp__")
    ? toolName.split("__")[2] || toolName
    : toolName;

  switch (baseName) {
    case "Bash":
      return Terminal;
    case "Read":
      return FileText;
    case "Write":
    case "Edit":
      return FileEdit;
    case "Grep":
      return Search;
    case "Glob":
      return FolderSearch;
    case "WebFetch":
    case "WebSearch":
      return Globe;
    case "TodoWrite":
      return ListTodo;
    case "Task":
      return Layers;
    case "LSP":
      return Code2;
    default:
      return Wrench;
  }
}

/**
 * Check if a tool is an MCP tool
 */
export function isMcpTool(toolName: string): boolean {
  return toolName.startsWith("mcp__");
}

/**
 * Check if a tool is a built-in tool
 */
export function isBuiltinTool(toolName: string): boolean {
  const builtinTools = [
    "Bash",
    "Read",
    "Write",
    "Edit",
    "Grep",
    "Glob",
    "WebFetch",
    "WebSearch",
    "TodoWrite",
    "Task",
    "LSP",
    "Skill",
  ];
  return builtinTools.includes(toolName);
}

/**
 * Check if a tool is a Skill invocation
 */
export function isSkillTool(toolName: string): boolean {
  return toolName === "Skill";
}

/**
 * Get display info for MCP tool
 */
export function getMcpToolInfo(toolName: string): { name: string; server: string } {
  if (toolName.startsWith("mcp__")) {
    const parts = toolName.split("__");
    const serverName = parts[1] || "unknown";
    const tool = parts[2] || "";
    return {
      name: tool || serverName,
      server: serverName,
    };
  }
  return { name: toolName, server: "" };
}

/**
 * Extract all tools from messages (both built-in and MCP)
 */
export function extractAllTools(messages: AgentMessage[]): ToolUsage[] {
  const tools: ToolUsage[] = [];
  const toolUseMessages = messages.filter(
    (m) => m.type === "tool_use" && m.name && !isSkillTool(m.name)
  );
  const toolResultMessages = messages.filter((m) => m.type === "tool_result");

  // Create a map of tool results by toolUseId
  const resultMap = new Map<string, { output: string; isError: boolean }>();
  toolResultMessages.forEach((msg) => {
    if (msg.toolUseId) {
      resultMap.set(msg.toolUseId, {
        output: msg.output || "",
        isError: msg.isError || false,
      });
    }
  });

  toolUseMessages.forEach((msg, index) => {
    const toolName = msg.name || "Unknown";
    const toolId = msg.id || `tool-${index}`;
    const result = resultMap.get(toolId);
    const info = getMcpToolInfo(toolName);

    tools.push({
      id: toolId,
      name: toolName,
      displayName: isMcpTool(toolName) ? info.name : toolName,
      input: msg.input,
      output: result?.output,
      isError: result?.isError,
      timestamp: Date.now() - (toolUseMessages.length - index) * 1000,
    });
  });

  return tools;
}

/**
 * Extract used skill info from messages
 */
export function extractUsedSkills(messages: AgentMessage[]): SkillInfo[] {
  const skillMap = new Map<string, SkillInfo>();
  const toolUseMessages = messages.filter(
    (m) => m.type === "tool_use" && isSkillTool(m.name || "")
  );

  toolUseMessages.forEach((msg) => {
    const input = msg.input as Record<string, unknown> | undefined;
    const skillName = input?.skill as string;
    if (skillName) {
      const existing = skillMap.get(skillName);
      if (existing) {
        existing.callCount++;
      } else {
        // Try to extract folder from skill name (format: folder/skill or just skill)
        const parts = skillName.split("/");
        const folder = parts.length > 1 ? parts[0] : undefined;
        const name = parts.length > 1 ? parts.slice(1).join("/") : skillName;
        skillMap.set(skillName, {
          name,
          folder,
          callCount: 1,
        });
      }
    }
  });

  return Array.from(skillMap.values());
}

/**
 * Group skills by folder
 */
export function groupSkillsByFolder(skills: SkillInfo[]): Map<string, SkillInfo[]> {
  const grouped = new Map<string, SkillInfo[]>();

  skills.forEach((skill) => {
    const folder = skill.folder || "root";
    const existing = grouped.get(folder) || [];
    existing.push(skill);
    grouped.set(folder, existing);
  });

  return grouped;
}

/**
 * Extract external folders from messages (folders outside workingDir that were accessed)
 */
export function extractExternalFolders(
  messages: AgentMessage[],
  workingDir?: string
): string[] {
  const foldersSet = new Set<string>();

  // Helper to add folder if it's external
  const addIfExternal = (filePath: string) => {
    const isUnixPath = filePath?.startsWith("/");
    const isWindowsPath = filePath && /^[A-Za-z]:\\/.test(filePath);
    if (!filePath || (!isUnixPath && !isWindowsPath)) return;

    // Get folder path
    const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
    const folderPath = lastSlash > 0
      ? filePath.substring(0, lastSlash)
      : (isWindowsPath ? filePath.substring(0, 3) : "/");

    // Only add if it's not within workingDir
    if (folderPath && (!workingDir || !filePath.startsWith(workingDir))) {
      foldersSet.add(folderPath);
    }
  };

  messages.forEach((msg) => {
    if (msg.type !== "tool_use") return;

    const input = msg.input as Record<string, unknown> | undefined;
    if (!input) return;

    switch (msg.name) {
      case "Read":
      case "Write":
      case "Edit": {
        const filePath = input.file_path as string | undefined;
        if (filePath) addIfExternal(filePath);
        break;
      }
      case "Glob":
      case "Grep": {
        const path = input.path as string | undefined;
        if (path) addIfExternal(path);
        break;
      }
    }
  });

  // Deduplicate - remove child folders if parent exists
  const folders = Array.from(foldersSet);
  return folders.filter((folder) => {
    return !folders.some(
      (other) => other !== folder && folder.startsWith(other + "/")
    );
  });
}

/**
 * Get file icon based on artifact type
 */
export function getArtifactIcon(type: ArtifactType) {
  switch (type) {
    case "html":
    case "jsx":
    case "css":
    case "code":
      return FileCode;
    case "json":
      return FileJson;
    case "markdown":
    case "document":
    case "pdf":
    case "text":
      return FileText;
    case "csv":
      return Table;
    case "spreadsheet":
      return FileSpreadsheet;
    case "presentation":
      return Presentation;
    case "image":
      return ImageIcon;
    case "audio":
      return Music;
    case "video":
      return Video;
    case "font":
      return TypeIcon;
    case "websearch":
      return Globe;
    default:
      return File;
  }
}
