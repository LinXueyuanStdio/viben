'use client';

import { useState } from 'react';
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
  Pencil,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCount } from '@/lib/utils/format';
import { OsIcon } from '@/components/shared/os-icon';
import { SkillSourceBadge } from './skill-source-tabs';
import type { ClawhubSkillDisplay } from '@/lib/types/clawhub-registry';

/**
 * Copy button with feedback
 */
function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

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

interface OfficialSkillHeaderProps {
  skill: ClawhubSkillDisplay;
}

export function OfficialSkillHeader({ skill }: OfficialSkillHeaderProps) {
  const { t } = useTranslation();

  // Generate install command
  const installCommand = `claude skill install ${skill.slug}`;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/skill-market?source=official"
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
            <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>

            <div>
              <div className="flex items-center gap-3 flex-wrap">
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

          <Badge variant="secondary" className="text-sm shrink-0">
            v{skill.version}
          </Badge>
        </div>

        {/* Compact info bar: slug + stats + OS badges */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {/* Slug */}
          <div className="flex items-center gap-1.5">
            <code className="bg-muted px-2 py-0.5 rounded font-mono text-xs">
              {skill.slug}
            </code>
            <CopyButton text={skill.slug} className="h-6 w-6" />
          </div>

          {/* Stats */}
          {skill.downloads > 0 && (
            <span className="flex items-center gap-1">
              <Download className="h-4 w-4" />
              {formatCount(skill.downloads)}
            </span>
          )}
          {skill.stars > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4" />
              {formatCount(skill.stars)}
            </span>
          )}

          {/* OS Badges */}
          {skill.os && skill.os.length > 0 && (
            <div className="flex items-center gap-1.5">
              {skill.os.map((os) => (
                <Badge key={os} variant="outline" className="text-xs gap-1">
                  <OsIcon os={os} className="h-3.5 w-3.5" />
                  {os}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Actions: View on ClaWHub + Edit this page */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://clawhub.ai/skills/${skill.slug}`, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {t('marketplace.viewOnClawhub', 'View on ClaWHub')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(`https://clawhub.ai/skills/${skill.slug}`, '_blank')}
          >
            <Pencil className="h-4 w-4 mr-2" />
            {t('marketplace.editThisPage', 'Edit this page')}
          </Button>
        </div>
      </div>

      {/* Installation - dark terminal-style */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-5 w-5" />
            {t('marketplace.installation', 'Installation')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-zinc-900 dark:bg-zinc-950 border border-zinc-700 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 border-b border-zinc-700">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
              </div>
              <span className="text-xs text-zinc-400 ml-2 font-mono">Terminal</span>
            </div>
            <div className="flex items-center p-3">
              <span className="text-zinc-400 font-mono text-sm select-none">$ </span>
              <code className="flex-1 text-sm text-zinc-100 font-mono px-1">
                {installCommand}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 shrink-0"
                onClick={async () => {
                  await navigator.clipboard.writeText(installCommand);
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {t('marketplace.installHint', 'Run this command in your terminal to install the skill.')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
