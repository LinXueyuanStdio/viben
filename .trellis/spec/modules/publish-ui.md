# T16: Publish UI

> Implement package publish wizard UI.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T16 |
| Dependencies | T13 (Packages API), T8 (MCP UI), T9 (Skills UI) |
| Effort | 3 points |
| Priority | P1 |

---

## Objectives

1. Create multi-step publish wizard
2. Implement package type selection
3. Add metadata form with validation
4. Implement file upload
5. Add review and submit step

---

## Deliverables

### 1. Publish Page (`apps/web/app/(dashboard)/publish/page.tsx`)

```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/cookies';
import { PublishWizard } from '@/components/publish/publish-wizard';

export default async function PublishPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login?redirect=/publish');
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Publish Package</h1>
        <p className="mt-2 text-muted-foreground">
          Share your MCP server or Skill with the community
        </p>
      </div>
      <PublishWizard />
    </div>
  );
}
```

### 2. Publish Wizard (`apps/web/components/publish/publish-wizard.tsx`)

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PackageTypeStep } from './steps/package-type-step';
import { MetadataStep } from './steps/metadata-step';
import { FilesStep } from './steps/files-step';
import { ReviewStep } from './steps/review-step';
import { Progress } from '@/components/ui/progress';

const STEPS = [
  { id: 'type', label: 'Package Type' },
  { id: 'metadata', label: 'Metadata' },
  { id: 'files', label: 'Files' },
  { id: 'review', label: 'Review' },
];

export interface PublishData {
  packageType: 'mcp' | 'skill' | null;
  name: string;
  slug: string;
  version: string;
  description: string;
  longDescription: string;
  category: string;
  tags: string[];
  repositoryUrl: string;
  // MCP-specific
  transport?: string;
  // Skill-specific
  skillType?: string;
  triggerPatterns?: string[];
  // Files
  packageFile: File | null;
  readmeFile: File | null;
}

const initialData: PublishData = {
  packageType: null,
  name: '',
  slug: '',
  version: '1.0.0',
  description: '',
  longDescription: '',
  category: '',
  tags: [],
  repositoryUrl: '',
  transport: 'stdio',
  skillType: 'standalone',
  triggerPatterns: [],
  packageFile: null,
  readmeFile: null,
};

export function PublishWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<PublishData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  function updateData(updates: Partial<PublishData>) {
    setData((prev) => ({ ...prev, ...updates }));
  }

  function nextStep() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }

  async function handleSubmit() {
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('packageType', data.packageType!);
      formData.append('name', data.name);
      formData.append('slug', data.slug);
      formData.append('version', data.version);
      formData.append('description', data.description);
      formData.append('longDescription', data.longDescription);
      formData.append('category', data.category);
      formData.append('tags', JSON.stringify(data.tags));
      formData.append('repositoryUrl', data.repositoryUrl);

      if (data.packageType === 'mcp') {
        formData.append('transport', data.transport!);
      } else {
        formData.append('skillType', data.skillType!);
        formData.append('triggerPatterns', JSON.stringify(data.triggerPatterns));
      }

      if (data.packageFile) {
        formData.append('packageFile', data.packageFile);
      }
      if (data.readmeFile) {
        formData.append('readmeFile', data.readmeFile);
      }

      const endpoint =
        data.packageType === 'mcp'
          ? '/api/packages/mcp'
          : '/api/packages/skills';

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to publish');
      }

      const result = await response.json();
      router.push(`/${data.packageType}/${result.package.id}`);
    } catch (error) {
      console.error('Publish error:', error);
      // Error handled by toast in step component
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          {STEPS.map((step, index) => (
            <span
              key={step.id}
              className={index <= currentStep ? 'text-primary' : ''}
            >
              {step.label}
            </span>
          ))}
        </div>
        <Progress value={progress} />
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {currentStep === 0 && (
          <PackageTypeStep
            data={data}
            updateData={updateData}
            onNext={nextStep}
          />
        )}
        {currentStep === 1 && (
          <MetadataStep
            data={data}
            updateData={updateData}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}
        {currentStep === 2 && (
          <FilesStep
            data={data}
            updateData={updateData}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}
        {currentStep === 3 && (
          <ReviewStep
            data={data}
            onSubmit={handleSubmit}
            onBack={prevStep}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}
```

### 3. Package Type Step (`apps/web/components/publish/steps/package-type-step.tsx`)

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Server, Zap, Check } from 'lucide-react';
import type { PublishData } from '../publish-wizard';

interface PackageTypeStepProps {
  data: PublishData;
  updateData: (updates: Partial<PublishData>) => void;
  onNext: () => void;
}

export function PackageTypeStep({
  data,
  updateData,
  onNext,
}: PackageTypeStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">What are you publishing?</h2>
        <p className="text-muted-foreground">
          Select the type of package you want to publish
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className={`cursor-pointer p-6 transition-colors hover:border-primary ${
            data.packageType === 'mcp' ? 'border-primary bg-primary/5' : ''
          }`}
          onClick={() => updateData({ packageType: 'mcp' })}
        >
          <div className="flex items-start justify-between">
            <Server className="h-10 w-10 text-blue-500" />
            {data.packageType === 'mcp' && (
              <Check className="h-5 w-5 text-primary" />
            )}
          </div>
          <h3 className="mt-4 text-lg font-semibold">MCP Server</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            A Model Context Protocol server that provides tools, resources, or
            prompts to AI assistants.
          </p>
          <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
            <li>• Supports stdio or SSE transport</li>
            <li>• Can provide tools, resources, prompts</li>
            <li>• Runs as a separate process</li>
          </ul>
        </Card>

        <Card
          className={`cursor-pointer p-6 transition-colors hover:border-primary ${
            data.packageType === 'skill' ? 'border-primary bg-primary/5' : ''
          }`}
          onClick={() => updateData({ packageType: 'skill' })}
        >
          <div className="flex items-start justify-between">
            <Zap className="h-10 w-10 text-yellow-500" />
            {data.packageType === 'skill' && (
              <Check className="h-5 w-5 text-primary" />
            )}
          </div>
          <h3 className="mt-4 text-lg font-semibold">Skill</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            A reusable skill or capability that can be triggered by AI
            assistants based on patterns.
          </p>
          <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
            <li>• Triggered by natural language patterns</li>
            <li>• Can be standalone or part of a plugin</li>
            <li>• Provides specific capabilities</li>
          </ul>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!data.packageType}>
          Continue
        </Button>
      </div>
    </div>
  );
}
```

### 4. Metadata Step (`apps/web/components/publish/steps/metadata-step.tsx`)

```tsx
'use client';

import { useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TagInput } from '@/components/shared/tag-input';
import type { PublishData } from '../publish-wizard';

const MCP_CATEGORIES = [
  'database',
  'api',
  'search',
  'file-system',
  'browser',
  'communication',
  'developer-tools',
  'other',
];

const SKILL_CATEGORIES = [
  'automation',
  'coding',
  'data',
  'communication',
  'research',
  'other',
];

const metadataSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Must be semver (e.g., 1.0.0)'),
  description: z.string().min(1, 'Description is required').max(200),
  category: z.string().min(1, 'Category is required'),
  repositoryUrl: z.string().url().optional().or(z.literal('')),
  transport: z.string().optional(),
  skillType: z.string().optional(),
});

interface MetadataStepProps {
  data: PublishData;
  updateData: (updates: Partial<PublishData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function MetadataStep({
  data,
  updateData,
  onNext,
  onBack,
}: MetadataStepProps) {
  const categories =
    data.packageType === 'mcp' ? MCP_CATEGORIES : SKILL_CATEGORIES;

  const form = useForm({
    resolver: zodResolver(metadataSchema),
    defaultValues: {
      name: data.name,
      slug: data.slug,
      version: data.version,
      description: data.description,
      category: data.category,
      repositoryUrl: data.repositoryUrl,
      transport: data.transport,
      skillType: data.skillType,
    },
  });

  // Auto-generate slug from name
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'name' && value.name && !form.getValues('slug')) {
        const slug = value.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        form.setValue('slug', slug);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  function onSubmit(values: z.infer<typeof metadataSchema>) {
    updateData({
      ...values,
      tags: data.tags,
    });
    onNext();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Package Details</h2>
        <p className="text-muted-foreground">
          Provide information about your{' '}
          {data.packageType === 'mcp' ? 'MCP server' : 'skill'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            placeholder="My Awesome Package"
            {...form.register('name')}
          />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            placeholder="my-awesome-package"
            {...form.register('slug')}
          />
          {form.formState.errors.slug && (
            <p className="text-sm text-destructive">
              {form.formState.errors.slug.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="version">Version</Label>
          <Input id="version" placeholder="1.0.0" {...form.register('version')} />
          {form.formState.errors.version && (
            <p className="text-sm text-destructive">
              {form.formState.errors.version.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select
            value={form.watch('category')}
            onValueChange={(v) => form.setValue('category', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.category && (
            <p className="text-sm text-destructive">
              {form.formState.errors.category.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Short Description</Label>
        <Input
          id="description"
          placeholder="A brief description of your package"
          {...form.register('description')}
        />
        {form.formState.errors.description && (
          <p className="text-sm text-destructive">
            {form.formState.errors.description.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="repositoryUrl">Repository URL (optional)</Label>
        <Input
          id="repositoryUrl"
          placeholder="https://github.com/you/repo"
          {...form.register('repositoryUrl')}
        />
      </div>

      {data.packageType === 'mcp' && (
        <div className="space-y-2">
          <Label>Transport</Label>
          <Select
            value={form.watch('transport')}
            onValueChange={(v) => form.setValue('transport', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select transport" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stdio">stdio</SelectItem>
              <SelectItem value="sse">SSE (Server-Sent Events)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {data.packageType === 'skill' && (
        <div className="space-y-2">
          <Label>Skill Type</Label>
          <Select
            value={form.watch('skillType')}
            onValueChange={(v) => form.setValue('skillType', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standalone">Standalone</SelectItem>
              <SelectItem value="plugin">Plugin Skill</SelectItem>
              <SelectItem value="command">Command</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>Tags</Label>
        <TagInput
          value={data.tags}
          onChange={(tags) => updateData({ tags })}
          placeholder="Add tags..."
        />
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit">Continue</Button>
      </div>
    </form>
  );
}
```

### 5. Files Step (`apps/web/components/publish/steps/files-step.tsx`)

```tsx
'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Upload, File, X } from 'lucide-react';
import type { PublishData } from '../publish-wizard';

interface FilesStepProps {
  data: PublishData;
  updateData: (updates: Partial<PublishData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function FilesStep({ data, updateData, onNext, onBack }: FilesStepProps) {
  const onDropPackage = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        updateData({ packageFile: acceptedFiles[0] });
      }
    },
    [updateData]
  );

  const onDropReadme = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        updateData({ readmeFile: acceptedFiles[0] });
      }
    },
    [updateData]
  );

  const packageDropzone = useDropzone({
    onDrop: onDropPackage,
    accept: {
      'application/zip': ['.zip'],
      'application/gzip': ['.tar.gz', '.tgz'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const readmeDropzone = useDropzone({
    onDrop: onDropReadme,
    accept: {
      'text/markdown': ['.md'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    maxSize: 1024 * 1024, // 1MB
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Upload Files</h2>
        <p className="text-muted-foreground">
          Upload your package and documentation
        </p>
      </div>

      {/* Package File */}
      <div className="space-y-2">
        <Label>Package File</Label>
        <div
          {...packageDropzone.getRootProps()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            packageDropzone.isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
        >
          <input {...packageDropzone.getInputProps()} />
          {data.packageFile ? (
            <div className="flex items-center justify-center gap-2">
              <File className="h-8 w-8 text-primary" />
              <div className="text-left">
                <p className="font-medium">{data.packageFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(data.packageFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  updateData({ packageFile: null });
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">
                Drag and drop your package file, or click to browse
              </p>
              <p className="text-sm text-muted-foreground">
                .zip or .tar.gz, max 50MB
              </p>
            </>
          )}
        </div>
      </div>

      {/* README */}
      <div className="space-y-2">
        <Label>Long Description / README</Label>
        <div
          {...readmeDropzone.getRootProps()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
            readmeDropzone.isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
        >
          <input {...readmeDropzone.getInputProps()} />
          {data.readmeFile ? (
            <div className="flex items-center justify-center gap-2">
              <File className="h-6 w-6 text-primary" />
              <span>{data.readmeFile.name}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  updateData({ readmeFile: null });
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Drop a README.md file or click to upload
            </p>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Or write your description directly:
        </p>
        <Textarea
          placeholder="# My Package\n\nDetailed description with Markdown support..."
          value={data.longDescription}
          onChange={(e) => updateData({ longDescription: e.target.value })}
          rows={10}
          className="font-mono"
        />
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Continue</Button>
      </div>
    </div>
  );
}
```

### 6. Review Step (`apps/web/components/publish/steps/review-step.tsx`)

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loader2, Server, Zap, File, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { PublishData } from '../publish-wizard';

interface ReviewStepProps {
  data: PublishData;
  onSubmit: () => Promise<void>;
  onBack: () => void;
  isSubmitting: boolean;
}

export function ReviewStep({
  data,
  onSubmit,
  onBack,
  isSubmitting,
}: ReviewStepProps) {
  async function handleSubmit() {
    try {
      await onSubmit();
      toast.success('Package published successfully!');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to publish package'
      );
    }
  }

  const Icon = data.packageType === 'mcp' ? Server : Zap;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Review & Publish</h2>
        <p className="text-muted-foreground">
          Review your package details before publishing
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <Icon className="h-12 w-12 text-primary" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold">{data.name}</h3>
              <Badge variant="secondary">v{data.version}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">@{data.slug}</p>
            <p className="mt-2">{data.description}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>{data.category}</Badge>
              {data.packageType === 'mcp' && (
                <Badge variant="outline">{data.transport}</Badge>
              )}
              {data.packageType === 'skill' && (
                <Badge variant="outline">{data.skillType}</Badge>
              )}
              {data.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>

            {data.repositoryUrl && (
              <p className="mt-4 text-sm text-muted-foreground">
                Repository:{' '}
                <a
                  href={data.repositoryUrl}
                  target="_blank"
                  rel="noopener"
                  className="text-primary hover:underline"
                >
                  {data.repositoryUrl}
                </a>
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Files Summary */}
      <Card className="p-4">
        <h4 className="font-semibold">Files</h4>
        <div className="mt-2 space-y-2">
          {data.packageFile ? (
            <div className="flex items-center gap-2 text-sm">
              <File className="h-4 w-4" />
              <span>{data.packageFile.name}</span>
              <span className="text-muted-foreground">
                ({(data.packageFile.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-yellow-600">
              <AlertCircle className="h-4 w-4" />
              <span>No package file uploaded</span>
            </div>
          )}

          {data.readmeFile ? (
            <div className="flex items-center gap-2 text-sm">
              <File className="h-4 w-4" />
              <span>{data.readmeFile.name}</span>
            </div>
          ) : data.longDescription ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <File className="h-4 w-4" />
              <span>
                Inline description ({data.longDescription.length} characters)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-yellow-600">
              <AlertCircle className="h-4 w-4" />
              <span>No description provided</span>
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
        >
          Back
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Publish Package
        </Button>
      </div>
    </div>
  );
}
```

---

## Required Dependencies

```bash
pnpm add react-dropzone
```

## Required shadcn/ui Components

```bash
pnpm dlx shadcn@latest add progress
```

---

## Acceptance Criteria

- [ ] Package type selection works
- [ ] Metadata form validates inputs
- [ ] Slug auto-generated from name
- [ ] Category dropdown populated correctly
- [ ] MCP-specific fields shown for MCP
- [ ] Skill-specific fields shown for Skills
- [ ] Tag input allows multiple tags
- [ ] File upload via drag-and-drop
- [ ] File size limits enforced
- [ ] README upload or inline input
- [ ] Review step shows all details
- [ ] Submit creates package and redirects
- [ ] Error handling with toasts
- [ ] Loading state during submission

---

## Notes

- Multi-step wizard with progress indicator
- Type-specific fields based on selection
- Files uploaded as FormData
- Redirects to package page on success
- Uses react-dropzone for file uploads
