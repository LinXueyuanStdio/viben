'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  ArrowLeft,
  Terminal,
  Download,
  Star,
  Apple,
  Monitor,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkillSourceBadge } from './skill-source-tabs';
import type { ClawhubSkillDisplay } from '@/lib/types/clawhub-registry';

/**
 * Format number with K/M suffix
 */
function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return String(count);
}

/**
 * Copy button with feedback
 */
function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}

/**
 * Get OS icon
 */
function OsIcon({ os }: { os: string }) {
  switch (os.toLowerCase()) {
    case 'macos':
    case 'darwin':
      return <Apple className="h-4 w-4" />;
    case 'linux':
    case 'windows':
    default:
      return <Monitor className="h-4 w-4" />;
  }
}

interface OfficialSkillHeaderProps {
  skill: ClawhubSkillDisplay;
  content?: string | null;
}

export function OfficialSkillHeader({ skill, content }: OfficialSkillHeaderProps) {
  const { t } = useTranslation();

  // Generate install command
  const installCommand = `claude skill install ${skill.slug}`;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/skills?source=official"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('marketplace.backToMarketplace', 'Back to Marketplace')}
      </Link>

      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            {/* Skill Icon */}
            <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{skill.name}</h1>
                <SkillSourceBadge source="official" />
                {skill.isSuspicious && (
                  <Badge
                    variant="outline"
                    className="text-amber-500 border-amber-500/50"
                  >
                    {t('marketplace.suspicious', 'Suspicious')}
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-lg text-muted-foreground">
                {skill.description || t('marketplace.noDescription', 'No description available')}
              </p>
            </div>
          </div>

          <Badge variant="secondary" className="text-sm">
            v{skill.version}
          </Badge>
        </div>

        {/* Skill Slug */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">{t('marketplace.skillSlug', 'Slug')}:</span>
          <code className="bg-muted px-2 py-1 rounded font-mono text-xs">
            {skill.slug}
          </code>
          <CopyButton text={skill.slug} className="h-6 w-6" />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {skill.downloads > 0 && (
            <span className="flex items-center gap-1">
              <Download className="h-4 w-4" />
              {formatCount(skill.downloads)} downloads
            </span>
          )}
          {skill.stars > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4" />
              {formatCount(skill.stars)} stars
            </span>
          )}
        </div>

        {/* OS Badges */}
        {skill.os && skill.os.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t('marketplace.platforms', 'Platforms')}:
            </span>
            {skill.os.map((os) => (
              <Badge key={os} variant="outline" className="text-xs gap-1">
                <OsIcon os={os} />
                {os}
              </Badge>
            ))}
          </div>
        )}

        {/* Links */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://clawhub.ai/skills/${skill.slug}`, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {t('marketplace.viewOnClawhub', 'View on ClaWHub')}
          </Button>
        </div>
      </div>

      {/* Installation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            {t('marketplace.installation', 'Installation')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-muted px-3 py-2 rounded font-mono overflow-x-auto">
                {installCommand}
              </code>
              <CopyButton text={installCommand} className="h-8 w-8 shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('marketplace.installHint', 'Run this command in your terminal to install the skill.')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Content/README */}
      {content && (
        <Card>
          <CardHeader>
            <CardTitle>{t('marketplace.readme', 'README')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg overflow-x-auto">
                {content}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
