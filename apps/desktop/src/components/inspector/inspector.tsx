import type { McpServerCapabilities } from "@/types";
import { InspectorTools } from "./inspector-tools";
import { InspectorResources } from "./inspector-resources";
import { InspectorPrompts } from "./inspector-prompts";
import { InspectorPing } from "./inspector-ping";
import { InspectorRoots } from "./inspector-roots";
import { InspectorSampling } from "./inspector-sampling";

interface InspectorProps {
  makeRequest: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
  serverCapabilities: McpServerCapabilities | null;
  activeTab?: "tools" | "resources" | "prompts" | "ping" | "roots" | "sampling";
}

export function Inspector({ makeRequest, serverCapabilities, activeTab = "tools" }: InspectorProps) {
  // Check server capabilities to determine which content to show
  const hasTools = serverCapabilities?.tools !== undefined;
  const hasResources = serverCapabilities?.resources !== undefined;
  const hasPrompts = serverCapabilities?.prompts !== undefined;
  const hasRoots = serverCapabilities?.roots !== undefined;
  const hasSampling = serverCapabilities?.sampling !== undefined;

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
    default:
      return <InspectorTools makeRequest={makeRequest} enabled={hasTools} />;
  }
}
