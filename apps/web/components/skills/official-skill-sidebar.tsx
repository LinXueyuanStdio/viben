'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Download, Star, User, Shield, Terminal, Copy, Check } from 'lucide-react';
import { formatCount } from '@/lib/utils/format';
import { OsIcon } from '@/components/shared/os-icon';
import type { ClawhubSkillDisplay } from '@/lib/types/clawhub-registry';

interface OfficialSkillSidebarProps {
  skill: ClawhubSkillDisplay;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function OfficialSkillSidebar({ skill }: OfficialSkillSidebarProps) {
  const { t } = useTranslation();
  const installCommand = `claude skill install ${skill.slug}`;
  const [copied, setCopied] = useState(false);

  const handleInstallCopy = async () => {
    await navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasPlatforms = skill.os && skill.os.length > 0;
  const hasSystems = skill.systems && skill.systems.length > 0;
  const hasCompatibility = hasPlatforms || hasSystems;

  return (
    <div className="space-y-4">
      {/* Install Button - prominent CTA */}
      <Button
        className="w-full gap-2"
        size="lg"
        onClick={handleInstallCopy}
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            {t('common.copied', 'Copied!')}
          </>
        ) : (
          <>
            <Terminal className="h-4 w-4" />
            {t('marketplace.installNow', 'Install Now')}
          </>
        )}
      </Button>

      {/* Owner Card - enhanced */}
      {skill.ownerHandle && (
        <Card>
          <CardContent className="pt-6">
            <a
              href={`https://clawhub.ai/${skill.ownerHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-3 text-center hover:opacity-80 transition-opacity"
            >
              {skill.ownerAvatar ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={skill.ownerAvatar}
                  alt={skill.ownerName || skill.ownerHandle}
                  className="h-16 w-16 rounded-full border-2 border-border"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                  <User className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="text-base font-semibold">
                  {skill.ownerName || skill.ownerHandle}
                </p>
                <p className="text-sm text-muted-foreground">
                  @{skill.ownerHandle}
                </p>
              </div>
            </a>
          </CardContent>
        </Card>
      )}

      {/* Info Card - merged Stats + Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t('marketplace.info', 'Info')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Version */}
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5">v</Badge>
              {t('marketplace.version', 'Version')}
            </span>
            <Badge variant="secondary">{skill.version}</Badge>
          </div>

          {/* Downloads */}
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Download className="h-4 w-4" />
              {t('marketplace.downloads', 'Downloads')}
            </span>
            <span className="font-medium">{formatCount(skill.downloads)}</span>
          </div>

          {/* Stars */}
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Star className="h-4 w-4" />
              {t('marketplace.stars', 'Stars')}
            </span>
            <span className="font-medium">{formatCount(skill.stars)}</span>
          </div>

          {/* Installs */}
          {skill.installs > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Download className="h-4 w-4" />
                {t('marketplace.installs', 'Installs')}
              </span>
              <span className="font-medium">{formatCount(skill.installs)}</span>
            </div>
          )}

          {/* Created */}
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {t('marketplace.created', 'Created')}
            </span>
            <span className="text-xs">{formatDate(skill.createdAt)}</span>
          </div>

          {/* Updated */}
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {t('marketplace.updated', 'Updated')}
            </span>
            <span className="text-xs">{formatDate(skill.updatedAt)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Compatibility Card - merged Platforms + Systems */}
      {hasCompatibility && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t('marketplace.compatibility', 'Compatibility')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {hasPlatforms && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  {t('marketplace.platforms', 'Platforms')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {skill.os!.map((os) => (
                    <Badge key={os} variant="outline" className="text-xs gap-1">
                      <OsIcon os={os} />
                      {os}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {hasSystems && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  {t('marketplace.systems', 'Systems')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {skill.systems!.map((system) => (
                    <Badge key={system} variant="outline" className="text-xs font-mono">
                      {system}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Security Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t('marketplace.security', 'Security')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Shield className={`h-4 w-4 ${skill.isSuspicious ? 'text-amber-500' : 'text-green-500'}`} />
            <span className="text-sm">
              {skill.isSuspicious
                ? t('marketplace.suspiciousWarning', 'Flagged for review')
                : t('marketplace.verified', 'Verified safe')}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Source Link */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t('marketplace.source', 'Source')}</CardTitle>
        </CardHeader>
        <CardContent>
          <a
            href={`https://clawhub.ai/skills/${skill.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline break-all"
          >
            clawhub.ai/skills/{skill.slug}
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
