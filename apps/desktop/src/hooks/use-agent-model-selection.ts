import { useCallback, useEffect, useMemo, useRef } from "react";
import type { SelectorOption } from "@viben/chat";
import type { AgentInfo } from "@/lib/gateway";
import { useAgentDetail, useAgents } from "@/hooks/use-workspace-resources";
import { useModels } from "@/hooks/use-models";
import { useProviders, type Provider } from "@/hooks/use-providers";
import {
  filterModelsByExecutor,
  filterModelsByProvider,
  filterProvidersByExecutor,
} from "@/lib/executor-constraints";
import { getAcpAgentProviderId } from "@/components/acp-chat/acp-agent-config";

export interface UseAgentModelSelectionOptions {
  workspacePath?: string | null;
  defaultExecutorType: string;
  defaultModel: string;
  selectedAgentId: string | null;
  selectedProviderId: string | null;
  storeExecutorType: string | null;
  storeModel: string | null;
  setSelectedAgentId: (id: string | null) => void;
  setSelectedProviderId: (id: string | null) => void;
  setExecutorType: (type: string) => void;
  setModel: (model: string) => void;
}

export interface UseAgentModelSelectionReturn {
  executorType: string;
  model: string;
  agents: AgentInfo[];
  globalAgents: AgentInfo[];
  workspaceAgents: AgentInfo[];
  selectedAgent: AgentInfo | undefined;
  selectedAgentId: string | null;
  selectedProviderId: string | null;
  providers: Provider[];
  agentOptions: SelectorOption[];
  providerOptions: SelectorOption[];
  modelOptions: SelectorOption[];
  agentSelectionReady: boolean;
  configLoading: boolean;
  configError: string | null;
  setSelectedAgentId: (id: string | null) => void;
  setSelectedProviderId: (id: string | null) => void;
  setExecutorType: (type: string) => void;
  setModel: (model: string) => void;
}

export interface AgentProviderDefaultDecisionInput {
  selectedAgentId: string | null;
  hasCurrentSelectedAgentDetail: boolean;
  selectedAgentProviderId: string | null;
  selectedProviderId: string | null;
  preferredAgentProviderId: string | null;
  filteredProviderIds: readonly string[];
}

export function useAgentModelSelection(options: UseAgentModelSelectionOptions): UseAgentModelSelectionReturn {
  const {
    workspacePath,
    defaultExecutorType,
    defaultModel,
    selectedAgentId,
    selectedProviderId,
    storeExecutorType,
    storeModel,
    setSelectedAgentId: setStoreSelectedAgentId,
    setSelectedProviderId: setStoreSelectedProviderId,
    setExecutorType: setStoreExecutorType,
    setModel: setStoreModel,
  } = options;

  const executorType = storeExecutorType ?? defaultExecutorType;
  const model = storeModel ?? defaultModel;

  const setExecutorType = useCallback((type: string) => {
    setStoreExecutorType(type);
  }, [setStoreExecutorType]);

  const manualProviderOverrideAgentIdRef = useRef<string | null>(null);
  const manualModelOverrideAgentIdRef = useRef<string | null>(null);

  const setModelInternal = useCallback((value: string) => {
    setStoreModel(value);
  }, [setStoreModel]);

  const setSelectedProviderIdInternal = useCallback((id: string | null) => {
    setStoreSelectedProviderId(id);
  }, [setStoreSelectedProviderId]);

  const setModel = useCallback((value: string) => {
    manualModelOverrideAgentIdRef.current = selectedAgentId;
    setModelInternal(value);
  }, [selectedAgentId, setModelInternal]);

  const setSelectedProviderId = useCallback((id: string | null) => {
    manualProviderOverrideAgentIdRef.current = selectedAgentId;
    setSelectedProviderIdInternal(id);
  }, [selectedAgentId, setSelectedProviderIdInternal]);

  const {
    agents: allAgents,
    loading: agentsLoading,
    error: agentsError,
  } = useAgents({
    workspacePath: workspacePath || undefined,
    includeGlobal: true,
  });

  const listSelectedAgent = useMemo(
    () => allAgents.find((agent) => agent.id === selectedAgentId),
    [allAgents, selectedAgentId]
  );

  const {
    agent: selectedAgentDetail,
    loading: selectedAgentDetailLoading,
    error: selectedAgentDetailError,
  } = useAgentDetail(selectedAgentId, workspacePath);
  const currentSelectedAgentDetail = selectedAgentDetail?.id === selectedAgentId
    ? selectedAgentDetail
    : null;

  const selectedAgent = useMemo<AgentInfo | undefined>(() => {
    if (!currentSelectedAgentDetail) return listSelectedAgent;
    return {
      id: currentSelectedAgentDetail.id,
      name: currentSelectedAgentDetail.name,
      executor_type: (currentSelectedAgentDetail.executor_type || listSelectedAgent?.executor_type || defaultExecutorType) as AgentInfo["executor_type"],
      source: normalizeAgentSource(currentSelectedAgentDetail.source, listSelectedAgent?.source),
      workspace_path: listSelectedAgent?.workspace_path ?? currentSelectedAgentDetail.workspace_path ?? workspacePath ?? "",
      agent_dir: currentSelectedAgentDetail.agent_dir ?? listSelectedAgent?.agent_dir,
      config_path: currentSelectedAgentDetail.config_path ?? listSelectedAgent?.config_path,
      mcp_config_path: listSelectedAgent?.mcp_config_path,
      mcp_server_count: listSelectedAgent?.mcp_server_count ?? currentSelectedAgentDetail.mcp_servers?.length ?? 0,
      skill_count: listSelectedAgent?.skill_count ?? currentSelectedAgentDetail.skills?.length ?? 0,
      description: currentSelectedAgentDetail.description ?? listSelectedAgent?.description,
      model: currentSelectedAgentDetail.model ?? listSelectedAgent?.model,
      provider_id: currentSelectedAgentDetail.provider_id ?? listSelectedAgent?.provider_id,
      system_prompt: currentSelectedAgentDetail.system_prompt ?? listSelectedAgent?.system_prompt,
      append_prompt: currentSelectedAgentDetail.append_prompt ?? listSelectedAgent?.append_prompt,
      temperature: currentSelectedAgentDetail.temperature ?? listSelectedAgent?.temperature,
      max_tokens: currentSelectedAgentDetail.max_tokens ?? listSelectedAgent?.max_tokens,
      executor_config: currentSelectedAgentDetail.executor_config ?? listSelectedAgent?.executor_config,
      mcp_servers: normalizeMcpServerNames(currentSelectedAgentDetail.mcp_servers) ?? listSelectedAgent?.mcp_servers,
      skills: currentSelectedAgentDetail.skills ?? listSelectedAgent?.skills,
      approval_mode: currentSelectedAgentDetail.approval_mode ?? listSelectedAgent?.approval_mode,
      is_template: currentSelectedAgentDetail.is_template ?? listSelectedAgent?.is_template,
      template_description: currentSelectedAgentDetail.template_description ?? listSelectedAgent?.template_description,
      created_at: currentSelectedAgentDetail.created_at ?? listSelectedAgent?.created_at,
      updated_at: currentSelectedAgentDetail.updated_at ?? listSelectedAgent?.updated_at,
    };
  }, [currentSelectedAgentDetail, defaultExecutorType, listSelectedAgent, workspacePath]);

  const effectiveExecutorType = selectedAgent?.executor_type ?? executorType;

  const {
    providers,
    loading: providersLoading,
    error: providersError,
  } = useProviders();

  const filteredProviders = useMemo(() => {
    return filterProvidersByExecutor(providers, effectiveExecutorType, {
      enabledOnly: true,
      chatOnly: true,
      sort: true,
    });
  }, [providers, effectiveExecutorType]);

  const selectedAgentProviderId = getAcpAgentProviderId(selectedAgent) ?? null;
  const selectedAgentModelId = selectedAgent?.model?.trim() || null;
  const selectedAgentDefaultsKey = selectedAgent
    ? [selectedAgent.id, selectedAgentProviderId ?? "", selectedAgentModelId ?? ""].join("|")
    : null;

  const preferredAgentProvider = useMemo(() => {
    if (selectedAgentProviderId) {
      const configuredProvider = filteredProviders.find((provider) => provider.id === selectedAgentProviderId);
      if (configuredProvider) return configuredProvider;
    }
    return filteredProviders.find((provider) => provider.is_default) ?? filteredProviders[0] ?? null;
  }, [filteredProviders, selectedAgentProviderId]);
  const preferredAgentProviderId = preferredAgentProvider?.id ?? null;

  const selectedProviderForModels = useMemo(
    () => filteredProviders.find((provider) => provider.id === selectedProviderId),
    [filteredProviders, selectedProviderId]
  );

  const {
    models: allModels,
    loading: modelsLoading,
    error: modelsError,
  } = useModels({
    providerId: selectedProviderForModels?.id,
    enabled: Boolean(selectedProviderForModels),
  });

  const globalAgents = useMemo(
    () => allAgents.filter((agent) => agent.source === "global"),
    [allAgents]
  );
  const workspaceAgents = useMemo(
    () => allAgents.filter((agent) => agent.source === "workspace"),
    [allAgents]
  );

  const agentSelectionReady = useMemo(
    () => !agentsLoading && !selectedAgentDetailLoading && (allAgents.length === 0 || Boolean(selectedAgent)),
    [agentsLoading, selectedAgentDetailLoading, allAgents.length, selectedAgent]
  );

  const agentOptions = useMemo<SelectorOption[]>(() => {
    const options: SelectorOption[] = [];
    workspaceAgents.forEach((agent) => {
      options.push({
        id: agent.id,
        label: agent.name,
        description: agent.executor_type,
        badge: "workspace",
      });
    });
    globalAgents.forEach((agent) => {
      options.push({
        id: agent.id,
        label: agent.name,
        description: agent.executor_type,
        badge: "global",
      });
    });
    return options;
  }, [workspaceAgents, globalAgents]);

  const providerOptions = useMemo<SelectorOption[]>(() => {
    return filteredProviders.map((provider) => ({
      id: provider.id,
      label: provider.name,
      description: provider.provider_type,
      badge: provider.is_default ? "default" : undefined,
    }));
  }, [filteredProviders]);

  const modelsFilteredByExecutor = useMemo(() => {
    const availableModels = allModels.filter((model) => model.is_available);
    return filterModelsByExecutor(availableModels, effectiveExecutorType);
  }, [allModels, effectiveExecutorType]);

  const filteredModels = useMemo(() => {
    if (!selectedProviderId) return [];
    return filterModelsByProvider(modelsFilteredByExecutor, selectedProviderId);
  }, [modelsFilteredByExecutor, selectedProviderId]);

  const modelOptions = useMemo<SelectorOption[]>(() => {
    return filteredModels.map((item) => ({
      id: item.id,
      label: item.name,
      description: item.provider_id,
      badge: item.is_default ? "default" : undefined,
    }));
  }, [filteredModels]);

  const appliedAgentProviderDefaultsRef = useRef<string | null>(null);
  const appliedAgentModelDefaultsRef = useRef<string | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV || selectedAgent?.id !== "deepseek-claudecode") return;
    console.debug("[useAgentModelSelection] DeepSeek ClaudeCode selection", {
      selectedAgentId,
      detailLoaded: Boolean(currentSelectedAgentDetail),
      selectedAgentProviderId,
      selectedProviderId,
      selectedAgentModelId,
      model,
      providerOptions: providerOptions.map((provider) => provider.id),
      modelOptions: modelOptions.map((item) => item.id),
    });
  }, [
    currentSelectedAgentDetail,
    model,
    modelOptions,
    providerOptions,
    selectedAgent?.id,
    selectedAgentId,
    selectedAgentModelId,
    selectedAgentProviderId,
    selectedProviderId,
  ]);

  useEffect(() => {
    if (!agentsLoading && allAgents.length > 0 && !selectedAgent) {
      const defaultAgent = workspaceAgents[0] ?? globalAgents[0];
      if (defaultAgent) {
        manualProviderOverrideAgentIdRef.current = null;
        manualModelOverrideAgentIdRef.current = null;
        setStoreSelectedAgentId(defaultAgent.id);
        setExecutorType(defaultAgent.executor_type);
      }
    }
  }, [agentsLoading, allAgents.length, selectedAgent, workspaceAgents, globalAgents, setStoreSelectedAgentId, setExecutorType]);

  useEffect(() => {
    if (manualProviderOverrideAgentIdRef.current === selectedAgentId) return;
    const nextProviderId = resolveAgentProviderDefault({
      selectedAgentId,
      hasCurrentSelectedAgentDetail: Boolean(currentSelectedAgentDetail),
      selectedAgentProviderId,
      selectedProviderId,
      preferredAgentProviderId,
      filteredProviderIds: filteredProviders.map((provider) => provider.id),
    });
    if (!selectedAgentDefaultsKey || appliedAgentProviderDefaultsRef.current === selectedAgentDefaultsKey) return;
    if (!nextProviderId) return;
    appliedAgentProviderDefaultsRef.current = selectedAgentDefaultsKey;
    if (selectedProviderId !== nextProviderId) {
      setSelectedProviderIdInternal(nextProviderId);
    }
  }, [
    currentSelectedAgentDetail,
    filteredProviders,
    preferredAgentProviderId,
    selectedAgentDefaultsKey,
    selectedAgentId,
    selectedAgentProviderId,
    selectedProviderId,
    setSelectedProviderIdInternal,
  ]);

  useEffect(() => {
    if (selectedAgentId && !currentSelectedAgentDetail && !selectedAgentProviderId) return;
    const currentProviderValid = selectedProviderId && filteredProviders.some((provider) => provider.id === selectedProviderId);
    if (!currentProviderValid && filteredProviders.length > 0) {
      const defaultProvider = filteredProviders.find((provider) => provider.is_default);
      setSelectedProviderIdInternal(defaultProvider?.id ?? filteredProviders[0]?.id ?? null);
    }
  }, [currentSelectedAgentDetail, filteredProviders, selectedAgentId, selectedAgentProviderId, selectedProviderId, setSelectedProviderIdInternal]);

  useEffect(() => {
    if (
      selectedAgentDefaultsKey &&
      appliedAgentModelDefaultsRef.current !== selectedAgentDefaultsKey
    ) {
      if (manualModelOverrideAgentIdRef.current === selectedAgentId) return;
      if (preferredAgentProviderId && selectedProviderId !== preferredAgentProviderId) return;
      if (filteredModels.length === 0) return;
      if (selectedAgentModelId && filteredModels.some((item) => item.id === selectedAgentModelId)) {
        appliedAgentModelDefaultsRef.current = selectedAgentDefaultsKey;
        if (model !== selectedAgentModelId) {
          setModelInternal(selectedAgentModelId);
        }
        return;
      }
    }

    const currentModelValid = model && filteredModels.some((item) => item.id === model);
    if (!currentModelValid && filteredModels.length > 0) {
      const defaultModelOption = filteredModels.find((item) => item.is_default);
      const newModelId = defaultModelOption?.id ?? filteredModels[0]?.id;
      if (newModelId) {
        setModelInternal(newModelId);
      }
    }
  }, [
    selectedAgentDefaultsKey,
    selectedAgentModelId,
    preferredAgentProviderId,
    selectedProviderId,
    filteredModels,
    model,
    selectedAgentId,
    setModelInternal,
  ]);

  const handleSetSelectedAgentId = useCallback((id: string | null) => {
    manualProviderOverrideAgentIdRef.current = null;
    manualModelOverrideAgentIdRef.current = null;
    setStoreSelectedAgentId(id);
    const agent = id ? allAgents.find((item) => item.id === id) : undefined;
    setStoreSelectedProviderId(getAcpAgentProviderId(agent) ?? null);
    setStoreModel(agent?.model?.trim() || defaultModel);
    if (id) {
      if (agent?.executor_type) {
        setExecutorType(agent.executor_type);
      }
    }
  }, [allAgents, defaultModel, setExecutorType, setStoreModel, setStoreSelectedAgentId, setStoreSelectedProviderId]);

  const configLoading = agentsLoading || selectedAgentDetailLoading || providersLoading || modelsLoading;
  const configError = agentsError || selectedAgentDetailError || providersError || modelsError || null;

  return {
    executorType: effectiveExecutorType,
    model,
    agents: allAgents,
    globalAgents,
    workspaceAgents,
    selectedAgent,
    selectedAgentId,
    selectedProviderId,
    providers,
    agentOptions,
    providerOptions,
    modelOptions,
    agentSelectionReady,
    configLoading,
    configError,
    setSelectedAgentId: handleSetSelectedAgentId,
    setSelectedProviderId,
    setExecutorType,
    setModel,
  };
}

function normalizeAgentSource(value: unknown, fallback?: AgentInfo["source"]): AgentInfo["source"] {
  return value === "global" || value === "workspace" ? value : fallback ?? "workspace";
}

export function resolveAgentProviderDefault(input: AgentProviderDefaultDecisionInput): string | null {
  const {
    selectedAgentId,
    hasCurrentSelectedAgentDetail,
    selectedAgentProviderId,
    selectedProviderId,
    preferredAgentProviderId,
    filteredProviderIds,
  } = input;
  if (selectedAgentId && !hasCurrentSelectedAgentDetail && !selectedAgentProviderId) return null;
  if (!selectedAgentProviderId) return null;
  if (!preferredAgentProviderId || preferredAgentProviderId !== selectedAgentProviderId) return null;
  if (!filteredProviderIds.includes(selectedAgentProviderId)) return null;
  return selectedProviderId === selectedAgentProviderId ? null : selectedAgentProviderId;
}

function normalizeMcpServerNames(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    if (typeof item === "string") return [item];
    if (item && typeof item === "object" && typeof (item as { name?: unknown }).name === "string") {
      return [(item as { name: string }).name];
    }
    return [];
  });
}
