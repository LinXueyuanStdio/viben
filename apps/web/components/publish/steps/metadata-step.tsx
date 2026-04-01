'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import type { PackageMetadata, PackageType } from '../publish-wizard';

interface MetadataStepProps {
  packageType: PackageType;
  metadata: PackageMetadata;
  onChange: (metadata: PackageMetadata) => void;
}

const MCP_CATEGORIES = [
  'general',
  'database',
  'file-system',
  'api',
  'web',
  'productivity',
  'development',
  'communication',
  'other',
];

const SKILL_CATEGORIES = [
  'general',
  'code-generation',
  'testing',
  'documentation',
  'refactoring',
  'debugging',
  'deployment',
  'other',
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Map category keys to translation keys
const CATEGORY_TRANSLATION_MAP: Record<string, string> = {
  'general': 'general',
  'database': 'database',
  'file-system': 'fileSystem',
  'api': 'api',
  'web': 'web',
  'productivity': 'productivity',
  'development': 'development',
  'communication': 'communication',
  'code-generation': 'codeGeneration',
  'testing': 'testing',
  'documentation': 'documentation',
  'refactoring': 'refactoring',
  'debugging': 'debugging',
  'deployment': 'deployment',
  'other': 'other',
};

export function MetadataStep({ packageType, metadata, onChange }: MetadataStepProps) {
  const { t } = useTranslation();
  const categories = packageType === 'mcp' ? MCP_CATEGORIES : SKILL_CATEGORIES;

  // Auto-generate slug from name
  useEffect(() => {
    if (metadata.name && !metadata.slug) {
      onChange({ ...metadata, slug: slugify(metadata.name) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadata.name]);

  const handleNameChange = (name: string) => {
    onChange({
      ...metadata,
      name,
      slug: slugify(name),
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">{t('publish.metadata.packageName')} {t('publish.metadata.required')}</Label>
          <Input
            id="name"
            value={metadata.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={t('publish.metadata.packageNamePlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">{t('publish.metadata.slug')} {t('publish.metadata.required')}</Label>
          <Input
            id="slug"
            value={metadata.slug}
            onChange={(e) => onChange({ ...metadata, slug: e.target.value })}
            placeholder={t('publish.metadata.slugPlaceholder')}
          />
          <p className="text-xs text-muted-foreground">
            {t('publish.metadata.slugHint')}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t('publish.metadata.shortDescription')} {t('publish.metadata.required')}</Label>
        <Input
          id="description"
          value={metadata.description}
          onChange={(e) => onChange({ ...metadata, description: e.target.value })}
          placeholder={t('publish.metadata.shortDescriptionPlaceholder')}
          maxLength={200}
        />
        <p className="text-xs text-muted-foreground">
          {t('publish.metadata.charactersCount', { count: metadata.description.length, max: 200 })}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="longDescription">{t('publish.metadata.longDescription')}</Label>
        <Textarea
          id="longDescription"
          value={metadata.longDescription}
          onChange={(e) =>
            onChange({ ...metadata, longDescription: e.target.value })
          }
          placeholder={t('publish.metadata.longDescriptionPlaceholder')}
          rows={6}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="version">{t('publish.metadata.version')}</Label>
          <Input
            id="version"
            value={metadata.version}
            onChange={(e) => onChange({ ...metadata, version: e.target.value })}
            placeholder={t('publish.metadata.versionPlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">{t('publish.metadata.category')}</Label>
          <Select
            value={metadata.category}
            onValueChange={(value) => onChange({ ...metadata, category: value })}
          >
            <SelectTrigger id="category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {t(`publish.metadata.categories.${CATEGORY_TRANSLATION_MAP[cat] || cat}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* MCP-specific fields */}
      {packageType === 'mcp' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="transport">{t('publish.metadata.transport')}</Label>
            <Select
              value={metadata.transport}
              onValueChange={(value: 'stdio' | 'sse' | 'http') =>
                onChange({ ...metadata, transport: value })
              }
            >
              <SelectTrigger id="transport">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stdio">stdio</SelectItem>
                <SelectItem value="sse">SSE</SelectItem>
                <SelectItem value="http">HTTP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entryPoint">{t('publish.metadata.entryPoint')}</Label>
            <Input
              id="entryPoint"
              value={metadata.entryPoint}
              onChange={(e) =>
                onChange({ ...metadata, entryPoint: e.target.value })
              }
              placeholder={t('publish.metadata.entryPointPlaceholder')}
            />
          </div>
        </div>
      )}

      {/* Skill-specific fields */}
      {packageType === 'skill' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="skillType">{t('publish.metadata.skillType')}</Label>
            <Select
              value={metadata.skillType}
              onValueChange={(value: 'command' | 'prompt' | 'agent') =>
                onChange({ ...metadata, skillType: value })
              }
            >
              <SelectTrigger id="skillType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="command">{t('publish.metadata.skillTypeCommand')}</SelectItem>
                <SelectItem value="prompt">{t('publish.metadata.skillTypePrompt')}</SelectItem>
                <SelectItem value="agent">{t('publish.metadata.skillTypeAgent')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">{t('publish.metadata.skillContent')} {t('publish.metadata.required')}</Label>
            <Textarea
              id="content"
              value={metadata.content}
              onChange={(e) => onChange({ ...metadata, content: e.target.value })}
              placeholder={t('publish.metadata.skillContentPlaceholder')}
              rows={8}
            />
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="tags">{t('publish.metadata.tags')}</Label>
        <Input
          id="tags"
          value={metadata.tags.join(', ')}
          onChange={(e) =>
            onChange({
              ...metadata,
              tags: e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }
          placeholder={t('publish.metadata.tagsPlaceholder')}
        />
        <p className="text-xs text-muted-foreground">
          {t('publish.metadata.tagsHint')}
        </p>
      </div>
    </div>
  );
}
