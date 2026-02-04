'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PackageTypeStep } from './steps/package-type-step';
import { MetadataStep } from './steps/metadata-step';
import { UploadStep } from './steps/upload-step';
import { ReviewStep } from './steps/review-step';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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

const STEPS = [
  { title: 'Package Type', description: 'Choose what to publish' },
  { title: 'Metadata', description: 'Add package information' },
  { title: 'Upload', description: 'Upload your package' },
  { title: 'Review', description: 'Review and submit' },
];

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

export function PublishWizard() {
  const router = useRouter();
  const [state, setState] = useState<PublishWizardState>({
    step: 0,
    packageType: null,
    metadata: initialMetadata,
    file: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const progress = ((state.step + 1) / STEPS.length) * 100;

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
    if (state.step < STEPS.length - 1) {
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
        state.packageType === 'mcp' ? '/api/mcp' : '/api/skills';

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

      toast.success('Package published successfully!');
      router.push(`/${state.packageType}/${pkg.id}`);
    } catch (error) {
      console.error('Failed to publish:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to publish package'
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

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">{STEPS[state.step].title}</span>
          <span className="text-muted-foreground">
            Step {state.step + 1} of {STEPS.length}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        <p className="text-sm text-muted-foreground">
          {STEPS[state.step].description}
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
          Back
        </Button>

        {state.step === STEPS.length - 1 ? (
          <Button onClick={handleSubmit} disabled={!canGoNext() || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Publish Package
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={!canGoNext()}>
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
