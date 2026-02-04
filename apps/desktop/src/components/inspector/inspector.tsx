import { useState } from "react";
import {
  Wrench,
  FileText,
  MessageSquare,
  Zap,
  FolderTree,
  ActivitySquare,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
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
}

export function Inspector({ makeRequest, serverCapabilities }: InspectorProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("tools");

  // Check server capabilities to determine which tabs to show
  const hasTools = serverCapabilities?.tools !== undefined;
  const hasResources = serverCapabilities?.resources !== undefined;
  const hasPrompts = serverCapabilities?.prompts !== undefined;
  const hasRoots = serverCapabilities?.roots !== undefined;
  const hasSampling = serverCapabilities?.sampling !== undefined;

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 h-auto p-1">
          <TabsTrigger
            value="tools"
            className="flex items-center gap-1.5 text-xs py-2"
          >
            <Wrench className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("inspector.tools")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="resources"
            className="flex items-center gap-1.5 text-xs py-2"
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("inspector.resources")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="prompts"
            className="flex items-center gap-1.5 text-xs py-2"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("inspector.prompts")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="ping"
            className="flex items-center gap-1.5 text-xs py-2"
          >
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("inspector.ping")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="roots"
            className="flex items-center gap-1.5 text-xs py-2"
          >
            <FolderTree className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("inspector.roots")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="sampling"
            className="flex items-center gap-1.5 text-xs py-2"
          >
            <ActivitySquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("inspector.sampling")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tools">
          <InspectorTools makeRequest={makeRequest} enabled={hasTools} />
        </TabsContent>

        <TabsContent value="resources">
          <InspectorResources makeRequest={makeRequest} enabled={hasResources} />
        </TabsContent>

        <TabsContent value="prompts">
          <InspectorPrompts makeRequest={makeRequest} enabled={hasPrompts} />
        </TabsContent>

        <TabsContent value="ping">
          <InspectorPing makeRequest={makeRequest} />
        </TabsContent>

        <TabsContent value="roots">
          <InspectorRoots enabled={hasRoots} />
        </TabsContent>

        <TabsContent value="sampling">
          <InspectorSampling makeRequest={makeRequest} enabled={hasSampling} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
