import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { PROVIDER_TYPE_LABELS } from "@/hooks/use-providers";
import type { Provider } from "@/hooks/use-providers";
import type { ModelOption } from "./agent-config-panel";

export interface ProviderModelSelectorProps {
  title: string;
  badge?: string;
  providerLabel?: string;
  modelLabel?: string;
  providers: Provider[];
  selectedProviderId: string;
  models: ModelOption[];
  selectedModel: string;
  modelPlaceholder?: string;
  emptyProvidersText?: string;
  emptyModelsText?: string;
  showBaseUrl?: boolean;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
}

export function ProviderModelSelector({
  title,
  badge,
  providerLabel = "Provider",
  modelLabel = "Model",
  providers,
  selectedProviderId,
  models,
  selectedModel,
  modelPlaceholder,
  emptyProvidersText = "Configure an enabled provider first.",
  emptyModelsText,
  showBaseUrl = false,
  onProviderChange,
  onModelChange,
}: ProviderModelSelectorProps) {
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{title}</Label>
        {badge && <span className="text-xs text-muted-foreground">{badge}</span>}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(180px,0.9fr)_minmax(220px,1.1fr)]">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">{providerLabel}</span>
          <Select
            value={selectedProviderId}
            onValueChange={onProviderChange}
            disabled={providers.length === 0}
          >
            <SelectTrigger className="h-auto min-h-10 items-start whitespace-normal py-2 [&>span]:line-clamp-none">
              {selectedProvider ? (
                <div className="min-w-0 flex-1 space-y-0.5 text-left">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="break-words font-medium leading-snug">{selectedProvider.name}</span>
                    {selectedProvider.is_default && (
                      <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                        Default
                      </Badge>
                    )}
                  </div>
                  <div className="break-all text-xs leading-snug text-muted-foreground">
                    {PROVIDER_TYPE_LABELS[selectedProvider.provider_type] ?? selectedProvider.provider_type}
                    {selectedProvider.base_url ? ` · ${selectedProvider.base_url}` : ""}
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground">选择 provider</span>
              )}
            </SelectTrigger>
            <SelectContent>
              {providers.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  <span className="flex min-w-0 flex-col gap-0.5 py-0.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{provider.name}</span>
                      {provider.is_default && (
                        <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                          Default
                        </Badge>
                      )}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {PROVIDER_TYPE_LABELS[provider.provider_type] ?? provider.provider_type}
                      {provider.base_url ? ` · ${provider.base_url}` : ""}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">{modelLabel}</span>
          <Select
            value={selectedModel}
            onValueChange={onModelChange}
            disabled={!selectedProvider || models.length === 0}
          >
            <SelectTrigger className="h-auto min-h-10 items-start whitespace-normal py-2 [&>span]:line-clamp-none">
              {selectedModel ? (
                <div className="min-w-0 flex-1 space-y-0.5 text-left">
                  <div className="break-all font-medium leading-snug">
                    {models.find((candidate) => candidate.id === selectedModel)?.name ?? selectedModel}
                  </div>
                  <div className="break-all text-xs leading-snug text-muted-foreground">
                    {selectedModel}
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground">
                  {selectedProvider ? (modelPlaceholder ?? "选择模型") : "先选择 provider"}
                </span>
              )}
            </SelectTrigger>
            <SelectContent>
              {models.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  <span className="flex min-w-0 flex-col gap-0.5 py-0.5">
                    <span className="truncate font-medium">{candidate.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{candidate.id}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {providers.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {emptyProvidersText}
        </p>
      )}
      {selectedProvider && models.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {emptyModelsText ?? `No enabled chat models for ${selectedProvider.name}.`}
        </p>
      )}
      {showBaseUrl && selectedProvider?.base_url && (
        <p className="truncate text-xs text-muted-foreground">
          Base URL: <span className="font-mono">{selectedProvider.base_url}</span>
        </p>
      )}
    </div>
  );
}
