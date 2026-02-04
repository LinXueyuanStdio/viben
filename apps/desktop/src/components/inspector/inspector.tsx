import type { McpServerCapabilities } from "@/types";
import { InspectorTools } from "./inspector-tools";
import { InspectorResources } from "./inspector-resources";
import { InspectorPrompts } from "./inspector-prompts";
import { InspectorPing } from "./inspector-ping";
import { InspectorRoots } from "./inspector-roots";
import { InspectorSampling } from "./inspector-sampling";
import { InspectorTasks } from "./inspector-tasks";
import { InspectorElicitations } from "./inspector-elicitations";
import { InspectorAuth } from "./inspector-auth";
import { InspectorMetadata } from "./inspector-metadata";

export type InspectorTab =
  | "tools"
  | "resources"
  | "prompts"
  | "ping"
  | "roots"
  | "sampling"
  | "tasks"
  | "elicitations"
  | "auth"
  | "metadata";

interface InspectorProps {
  makeRequest: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
  serverCapabilities: McpServerCapabilities | null;
  serverInfo?: {
    name?: string;
    version?: string;
    protocolVersion?: string;
  };
  activeTab?: InspectorTab;
}

export function Inspector({
  makeRequest,
  serverCapabilities,
  serverInfo,
  activeTab = "tools"
}: InspectorProps) {
  // Check server capabilities to determine which content to show
  const hasTools = serverCapabilities?.tools !== undefined;
  const hasResources = serverCapabilities?.resources !== undefined;
  const hasPrompts = serverCapabilities?.prompts !== undefined;
  const hasRoots = serverCapabilities?.roots !== undefined;
  const hasSampling = serverCapabilities?.sampling !== undefined;
  // Tasks capability check - MCP 2024-11-05 added tasks support
  const hasTasks = (serverCapabilities as Record<string, unknown>)?.tasks !== undefined;

  // Render content based on active tab
  switch (activeTab) {
    case "tools":
      return <InspectorTools makeRequest={makeRequest} enabled={hasTools} />;
    case "resources":
      return <InspectorResources makeRequest={makeRequest} enabled={hasResources} />;
    case "prompts":
      return <InspectorPrompts makeRequest={makeRequest} enabled={hasPrompts} />;
    case "ping":
      return <InspectorPing makeRequest={makeRequest} />;
    case "roots":
      return <InspectorRoots enabled={hasRoots} />;
    case "sampling":
      return <InspectorSampling makeRequest={makeRequest} enabled={hasSampling} />;
    case "tasks":
      return <InspectorTasks makeRequest={makeRequest} enabled={hasTasks} />;
    case "elicitations":
      return <InspectorElicitations makeRequest={makeRequest} enabled={true} />;
    case "auth":
      return <InspectorAuth makeRequest={makeRequest} enabled={true} />;
    case "metadata":
      return (
        <InspectorMetadata
          makeRequest={makeRequest}
          serverCapabilities={serverCapabilities}
          serverInfo={serverInfo}
          enabled={true}
        />
      );
    default:
      return <InspectorTools makeRequest={makeRequest} enabled={hasTools} />;
  }
}
