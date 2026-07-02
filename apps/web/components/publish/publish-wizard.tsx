'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PackageTypeStep } from './steps/package-type-step';
import { MetadataStep } from './steps/metadata-step';
import { UploadStep } from './steps/upload-step';
import { ReviewStep } from './steps/review-step';
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAutoSave } from '@/hooks/use-auto-save';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type PackageType = 'mcp' | 'skill';

export interface PackageMetadata {
  name: string;
  slug: string;
  description: string;
  longDescription: string;
  version: string;
  category: string;
  tags: string[];
  // MCP specific
  transport?: 'stdio' | 'sse' | 'http';
  entryPoint?: string;
  // Skill specific
  skillType?: 'command' | 'prompt' | 'agent';
  triggerPatterns?: string[];
  content?: string;
}

export interface PublishWizardState {
  step: number;
  packageType: PackageType | null;
  metadata: PackageMetadata;
  file: File | null;
}

/** Shape persisted in localStorage (file is omitted — not serializable) */
interface PublishWizardDraft {
  step: number;
  packageType: PackageType | null;
  metadata: PackageMetadata;
}

const STEP_KEYS = ['packageType', 'metadata', 'upload', 'review'] as const;

const initialMetadata: PackageMetadata = {
  name: '',
  slug: '',
  description: '',
  longDescription: '',
  version: '1.0.0',
  category: 'general',
  tags: [],
  transport: 'stdio',
  entryPoint: '',
  skillType: 'command',
  triggerPatterns: [],
  content: '',
};

interface PublishWizardProps {
  initialType?: PackageType
}

export function PublishWizard({ initialType }: PublishWizardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [state, setState] = useState<PublishWizardState>({
    step: initialType ? 1 : 0,
    packageType: initialType ?? null,
    metadata: initialMetadata,
    file: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Draft restoration
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const draftHandledRef = useRef(false);

  // Build draft key
  const draftKey = useMemo(
    () => `publish-wizard:${initialType ?? 'any'}`,
    [initialType],
  );

  // Build draft data (omit non-serializable File)
  const draftData = useMemo<PublishWizardDraft>(() => ({
    step: state.step,
    packageType: state.packageType,
    metadata: state.metadata,
  }), [state.step, state.packageType, state.metadata]);

  const hasChanges = useMemo(() => {
    return (
      state.packageType !== null ||
      state.metadata.name !== '' ||
      state.metadata.description !== '' ||
      state.file !== null
    );
  }, [state]);

  const { saved, saving, restoreDraft, clearDraft, hasDraft } = useAutoSave<PublishWizardDraft>({
    key: draftKey,
    data: draftData,
    debounceMs: 3000,
    enabled: hasChanges,
  });

  // Check for existing draft on mount
  useEffect(() => {
    if (draftHandledRef.current) return;
    draftHandledRef.current = true;
    if (!initialType && hasDraft()) {
      setShowDraftDialog(true);
    }
  }, [initialType, hasDraft]);

  const handleRestoreDraft = useCallback(() => {
    const draft = restoreDraft();
    if (draft) {
      setState((prev) => ({
        ...prev,
        step: draft.step,
        packageType: draft.packageType,
        metadata: draft.metadata,
      }));
      toast.success(t('publish.toast.draftRestored', '草稿已恢复'));
    }
    setShowDraftDialog(false);
  }, [restoreDraft, t]);

  const handleDiscardDraft = useCallback(() => {
    clearDraft();
    setShowDraftDialog(false);
  }, [clearDraft]);

  // beforeunload protection
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);

  const progress = ((state.step + 1) / STEP_KEYS.length) * 100;

  const canGoNext = () => {
    switch (state.step) {
      case 0:
        return state.packageType !== null;
      case 1:
        return (
          state.metadata.name.length > 0 &&
          state.metadata.slug.length > 0 &&
          state.metadata.description.length > 0
        );
      case 2:
        return state.file !== null || state.packageType === 'skill';
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (state.step < STEP_KEYS.length - 1) {
      setState((prev) => ({ ...prev, step: prev.step + 1 }));
    }
  };

  const handleBack = () => {
    if (state.step > 0) {
      setState((prev) => ({ ...prev, step: prev.step - 1 }));
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Create the package first
      const createEndpoint =
        state.packageType === 'mcp' ? '/api/mcp' : '/api/skill';

      const packageData =
        state.packageType === 'mcp'
          ? {
              name: state.metadata.name,
              slug: state.metadata.slug,
              description: state.metadata.description,
              longDescription: state.metadata.longDescription,
              version: state.metadata.version,
              category: state.metadata.category,
              tags: state.metadata.tags,
              transport: state.metadata.transport,
              entryPoint: state.metadata.entryPoint,
            }
          : {
              name: state.metadata.name,
              slug: state.metadata.slug,
              description: state.metadata.description,
              longDescription: state.metadata.longDescription,
              version: state.metadata.version,
              category: state.metadata.category,
              tags: state.metadata.tags,
              skillType: state.metadata.skillType,
              triggerPatterns: state.metadata.triggerPatterns,
              content: state.metadata.content,
            };

      const createRes = await fetch(createEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(packageData),
      });

      if (!createRes.ok) {
        const error = await createRes.json();
        throw new Error(error.error || 'Failed to create package');
      }

      const { [state.packageType === 'mcp' ? 'mcp' : 'skill']: pkg } =
        await createRes.json();

      // Upload file if provided
      if (state.file) {
        const formData = new FormData();
        formData.append('file', state.file);
        formData.append('entityId', pkg.id);
        formData.append('version', state.metadata.version);

        const uploadEndpoint =
          state.packageType === 'mcp'
            ? '/api/packages/mcp'
            : '/api/packages/skills';

        const uploadRes = await fetch(uploadEndpoint, {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const error = await uploadRes.json();
          throw new Error(error.error || 'Failed to upload package');
        }
      }

      // Clear draft on success
      clearDraft();
      toast.success(t('publish.toast.publishSuccess'));
      const routePrefix = state.packageType === 'mcp' ? 'mcp-market' : 'skill-market';
      router.push(`/${routePrefix}/${pkg.id}`);
    } catch (error) {
      console.error('Failed to publish:', error);
      toast.error(
        error instanceof Error ? error.message : t('publish.toast.publishFailed')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (state.step) {
      case 0:
        return (
          <PackageTypeStep
            selected={state.packageType}
            onSelect={(type) => setState((prev) => ({ ...prev, packageType: type }))}
          />
        );
      case 1:
        return (
          <MetadataStep
            packageType={state.packageType!}
            metadata={state.metadata}
            onChange={(metadata) => setState((prev) => ({ ...prev, metadata }))}
          />
        );
      case 2:
        return (
          <UploadStep
            packageType={state.packageType!}
            file={state.file}
            onFileChange={(file) => setState((prev) => ({ ...prev, file }))}
          />
        );
      case 3:
        return (
          <ReviewStep
            packageType={state.packageType!}
            metadata={state.metadata}
            file={state.file}
          />
        );
      default:
        return null;
    }
  };

  const stepKey = STEP_KEYS[state.step];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Draft restoration dialog */}
      <Dialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              {t('publish.wizard.draftFoundTitle', '未保存的草稿')}
            </DialogTitle>
            <DialogDescription>
              {t('publish.wizard.draftFoundDescription', '检测到之前未完成的发布流程。是否恢复草稿？')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDiscardDraft}>
              {t('publish.wizard.discardDraft', '丢弃草稿')}
            </Button>
            <Button onClick={handleRestoreDraft}>
              {t('publish.wizard.restoreDraft', '恢复草稿')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">{t(`publish.steps.${stepKey}.title`)}</span>
          <span className="text-muted-foreground">
            {t('publish.wizard.stepOf', { current: state.step + 1, total: STEP_KEYS.length })}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        <p className="text-sm text-muted-foreground">
          {t(`publish.steps.${stepKey}.description`)}
        </p>
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">{renderStep()}</div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={state.step === 0 || isSubmitting}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          {t('publish.wizard.back')}
        </Button>

        <div className="flex items-center gap-3">
          {/* Auto-save status */}
          {hasChanges && (
            <span className={`text-[11px] ${saving ? 'text-amber-500' : saved ? 'text-emerald-500' : 'text-muted-foreground'}`}>
              {saving ? t('publish.wizard.saving', '保存中...') : saved ? t('publish.wizard.saved', '已保存') : ''}
            </span>
          )}

          {state.step === STEP_KEYS.length - 1 ? (
            <Button onClick={handleSubmit} disabled={!canGoNext() || isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('publish.wizard.publishPackage')}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!canGoNext()}>
              {t('publish.wizard.next')}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
