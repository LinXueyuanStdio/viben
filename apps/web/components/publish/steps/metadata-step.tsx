'use client';

import { useEffect } from 'react';
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

export function MetadataStep({ packageType, metadata, onChange }: MetadataStepProps) {
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
          <Label htmlFor="name">Package Name *</Label>
          <Input
            id="name"
            value={metadata.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="My Awesome Package"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug *</Label>
          <Input
            id="slug"
            value={metadata.slug}
            onChange={(e) => onChange({ ...metadata, slug: e.target.value })}
            placeholder="my-awesome-package"
          />
          <p className="text-xs text-muted-foreground">
            URL-friendly identifier
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Short Description *</Label>
        <Input
          id="description"
          value={metadata.description}
          onChange={(e) => onChange({ ...metadata, description: e.target.value })}
          placeholder="A brief description of what this package does"
          maxLength={200}
        />
        <p className="text-xs text-muted-foreground">
          {metadata.description.length}/200 characters
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="longDescription">Long Description</Label>
        <Textarea
          id="longDescription"
          value={metadata.longDescription}
          onChange={(e) =>
            onChange({ ...metadata, longDescription: e.target.value })
          }
          placeholder="Detailed description with features, usage examples, etc. Markdown supported."
          rows={6}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="version">Version</Label>
          <Input
            id="version"
            value={metadata.version}
            onChange={(e) => onChange({ ...metadata, version: e.target.value })}
            placeholder="1.0.0"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
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
                  {cat.charAt(0).toUpperCase() + cat.slice(1).replace(/-/g, ' ')}
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
            <Label htmlFor="transport">Transport</Label>
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
            <Label htmlFor="entryPoint">Entry Point</Label>
            <Input
              id="entryPoint"
              value={metadata.entryPoint}
              onChange={(e) =>
                onChange({ ...metadata, entryPoint: e.target.value })
              }
              placeholder="npx @scope/package or uvx package"
            />
          </div>
        </div>
      )}

      {/* Skill-specific fields */}
      {packageType === 'skill' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="skillType">Skill Type</Label>
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
                <SelectItem value="command">Command</SelectItem>
                <SelectItem value="prompt">Prompt</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Skill Content *</Label>
            <Textarea
              id="content"
              value={metadata.content}
              onChange={(e) => onChange({ ...metadata, content: e.target.value })}
              placeholder="The skill content (markdown or instructions)"
              rows={8}
            />
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="tags">Tags</Label>
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
          placeholder="tag1, tag2, tag3"
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated list of tags
        </p>
      </div>
    </div>
  );
}
