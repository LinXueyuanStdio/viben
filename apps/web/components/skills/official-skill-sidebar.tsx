'use client';

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Download, Star, User, Apple, Monitor, Shield } from 'lucide-react';
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
 * Get OS icon
 */
function OsIcon({ os }: { os: string }) {
  switch (os.toLowerCase()) {
    case 'macos':
    case 'darwin':
      return <Apple className="h-3 w-3" />;
    case 'linux':
    case 'windows':
    default:
      return <Monitor className="h-3 w-3" />;
  }
}

export function OfficialSkillSidebar({ skill }: OfficialSkillSidebarProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('marketplace.stats', 'Stats')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Download className="h-4 w-4" />
              {t('marketplace.downloads', 'Downloads')}
            </span>
            <span className="font-medium">{formatCount(skill.downloads)}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Star className="h-4 w-4" />
              {t('marketplace.stars', 'Stars')}
            </span>
            <span className="font-medium">{formatCount(skill.stars)}</span>
          </div>

          {skill.installs > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Download className="h-4 w-4" />
                {t('marketplace.installs', 'Installs')}
              </span>
              <span className="font-medium">{formatCount(skill.installs)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('marketplace.details', 'Details')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {t('marketplace.created', 'Created')}
            </span>
            <span className="text-xs">{formatDate(skill.createdAt)}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {t('marketplace.updated', 'Updated')}
            </span>
            <span className="text-xs">{formatDate(skill.updatedAt)}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Badge variant="secondary" className="text-[10px]">v</Badge>
              {t('marketplace.version', 'Version')}
            </span>
            <Badge variant="secondary">{skill.version}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Owner */}
      {skill.ownerHandle && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('marketplace.owner', 'Owner')}</CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={`https://clawhub.ai/${skill.ownerHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              {skill.ownerAvatar ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={skill.ownerAvatar}
                  alt={skill.ownerName || skill.ownerHandle}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {skill.ownerName || skill.ownerHandle}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  @{skill.ownerHandle}
                </p>
              </div>
            </a>
          </CardContent>
        </Card>
      )}

      {/* Platforms */}
      {skill.os && skill.os.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('marketplace.platforms', 'Platforms')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {skill.os.map((os) => (
                <Badge key={os} variant="outline" className="text-xs gap-1">
                  <OsIcon os={os} />
                  {os}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Systems */}
      {skill.systems && skill.systems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('marketplace.systems', 'Systems')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {skill.systems.map((system) => (
                <Badge key={system} variant="outline" className="text-xs font-mono">
                  {system}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Status */}
      <Card>
        <CardHeader>
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

      {/* ClaWHub Link */}
      <Card>
        <CardHeader>
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
