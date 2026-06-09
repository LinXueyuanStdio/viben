/**
 * useAcpChatConfig Hook
 *
 * 为 AcpChat 组件提供 provider/model 选择逻辑，从 Gateway API 获取数据，
 * 并根据 executor_type 的约束过滤可用的模型。
 *
 * 约束逻辑：
 * - CLAUDE_CODE: 仅支持 anthropic provider 的模型
 * - CODEX: 仅支持 openai provider 的模型
 * - GEMINI: 仅支持 google provider 的模型
 * - OPENCLAW: 支持所有 provider
 * - 其他 executor 有各自的 provider 限制
 */

import { useEffect, useMemo, useCallback, useRef } from "react";
import type { SelectorOption } from "@viben/chat";
import { useModels } from "@/hooks/use-models";
import { useProviders } from "@/hooks/use-providers";
import type { WorkspaceModel } from "@/lib/gateway";
import { filterModelsByExecutor, getAllowedProviders, type ProviderId } from "@/lib/executor-constraints";

// ============================================================================
// Types
// ============================================================================

export interface UseAcpChatConfigOptions {
  /** 当前选中的 executor 类型 */
  executorType: string;
  /** 当前选中的 provider ID */
  selectedProviderId: string | null;
  /** 当前选中的 model ID */
  selectedModelId: string;
  /** Provider 变更回调 */
  onProviderChange: (providerId: string | null) => void;
  /** Model 变更回调 */
  onModelChange: (modelId: string) => void;
}

export interface UseAcpChatConfigReturn {
  /** Provider 选项列表 (用于 TripleSelector) */
  providerOptions: SelectorOption[];
  /** Model 选项列表 (已根据 provider 过滤) */
  modelOptions: SelectorOption[];
  /** 过滤后的原始 model 数据 */
  filteredModels: WorkspaceModel[];
  /** 加载状态 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 刷新数据 */
  refresh: () => Promise<void>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAcpChatConfig({
  executorType,
  selectedProviderId,
  selectedModelId,
  onProviderChange,
  onModelChange,
}: UseAcpChatConfigOptions): UseAcpChatConfigReturn {
  // 从 Gateway API 加载 providers 和 models
  const {
    providers,
    loading: providersLoading,
    error: providersError,
    refresh: refreshProviders,
  } = useProviders();

  const {
    models,
    loading: modelsLoading,
    error: modelsError,
    refresh: refreshModels,
  } = useModels();

  // 追踪上次的 executor 类型，用于检测变化
  const prevExecutorTypeRef = useRef(executorType);
  // 追踪上次的 provider ID，用于检测变化
  const prevProviderIdRef = useRef(selectedProviderId);

  // 1. 根据 executor 类型获取允许的 provider 列表
  const allowedProviderIds = useMemo(() => {
    return getAllowedProviders(executorType);
  }, [executorType]);

  // 2. 过滤 provider 选项
  const filteredProviders = useMemo(() => {
    // 只显示已启用且有 API key 配置的 providers
    const enabledProviders = providers.filter((p) => p.enabled);

    // 如果 executor 没有 provider 限制，返回所有启用的 providers
    if (!allowedProviderIds || allowedProviderIds.length === 0) {
      return enabledProviders;
    }

    // 根据 executor 约束过滤 providers
    return enabledProviders.filter((p) =>
      allowedProviderIds.includes(p.provider_type as ProviderId)
    );
  }, [providers, allowedProviderIds]);

  // 3. 将 provider 转换为 SelectorOption 格式
  const providerOptions = useMemo<SelectorOption[]>(() => {
    return filteredProviders.map((p) => ({
      id: p.id,
      label: p.name,
      description: p.provider_type,
      badge: p.is_default ? "default" : undefined,
    }));
  }, [filteredProviders]);

  // 4. 根据 executor 类型过滤 models
  const modelsFilteredByExecutor = useMemo(() => {
    // 只保留可用的 models
    const availableModels = models.filter((m) => m.is_available);
    return filterModelsByExecutor(availableModels, executorType);
  }, [models, executorType]);

  // 5. 再根据选中的 provider 过滤 models
  const filteredModels = useMemo(() => {
    if (!selectedProviderId) {
      return modelsFilteredByExecutor;
    }

    // 找到选中 provider 的类型
    const selectedProvider = filteredProviders.find((p) => p.id === selectedProviderId);
    if (!selectedProvider) {
      return modelsFilteredByExecutor;
    }

    // 按 provider_id 过滤
    return modelsFilteredByExecutor.filter(
      (m) => m.provider_id.toLowerCase() === selectedProvider.provider_type.toLowerCase()
    );
  }, [modelsFilteredByExecutor, selectedProviderId, filteredProviders]);

  // 6. 将 models 转换为 SelectorOption 格式
  const modelOptions = useMemo<SelectorOption[]>(() => {
    return filteredModels.map((m) => ({
      id: m.id,
      label: m.name,
      description: m.provider_id,
      badge: m.is_default ? "default" : undefined,
    }));
  }, [filteredModels]);

  // 7. 当 executor 类型变化时，自动选择第一个可用的 provider
  useEffect(() => {
    if (prevExecutorTypeRef.current !== executorType) {
      prevExecutorTypeRef.current = executorType;

      // 检查当前选中的 provider 是否仍然有效
      const currentProviderValid = filteredProviders.some((p) => p.id === selectedProviderId);

      if (!currentProviderValid && filteredProviders.length > 0) {
        // 优先选择默认 provider
        const defaultProvider = filteredProviders.find((p) => p.is_default);
        const newProviderId = defaultProvider?.id ?? filteredProviders[0]?.id ?? null;
        onProviderChange(newProviderId);
      }
    }
  }, [executorType, filteredProviders, selectedProviderId, onProviderChange]);

  // 8. 当 provider 变化时，自动选择第一个可用的 model
  useEffect(() => {
    if (prevProviderIdRef.current !== selectedProviderId) {
      prevProviderIdRef.current = selectedProviderId;

      // 检查当前选中的 model 是否仍然有效
      const currentModelValid = filteredModels.some((m) => m.id === selectedModelId);

      if (!currentModelValid && filteredModels.length > 0) {
        // 优先选择默认 model
        const defaultModel = filteredModels.find((m) => m.is_default);
        const newModelId = defaultModel?.id ?? filteredModels[0]?.id;
        if (newModelId) {
          onModelChange(newModelId);
        }
      }
    }
  }, [selectedProviderId, filteredModels, selectedModelId, onModelChange]);

  // 9. 刷新数据
  const refresh = useCallback(async () => {
    await Promise.all([refreshProviders(), refreshModels()]);
  }, [refreshProviders, refreshModels]);

  return {
    providerOptions,
    modelOptions,
    filteredModels,
    isLoading: providersLoading || modelsLoading,
    error: providersError || modelsError,
    refresh,
  };
}
