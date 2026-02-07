'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  Package,
  GitBranch,
  Globe,
  ExternalLink,
  Copy,
  Check,
  ArrowLeft,
  Terminal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SourceBadge } from './source-tabs';
import { getPackageTypeLabel } from './official-server-card';
import type {
  OfficialServerDisplay,
  OfficialPackage,
} from '@/lib/types/official-registry';

/**
 * Get the install command for a package
 */
function getInstallCommand(pkg: OfficialPackage): string {
  switch (pkg.registryType) {
    case 'npm':
      return `npx ${pkg.identifier}${pkg.version ? `@${pkg.version}` : ''}`;
    case 'pypi':
      return `uvx ${pkg.identifier}${pkg.version ? `==${pkg.version}` : ''}`;
    case 'oci':
      return `docker run ${pkg.identifier}${pkg.version ? `:${pkg.version}` : ''}`;
    case 'nuget':
      return `dotnet tool install ${pkg.identifier}${pkg.version ? ` --version ${pkg.version}` : ''}`;
    case 'mcpb':
      return `# Download from registry: ${pkg.identifier}`;
    default:
      return pkg.identifier;
  }
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
 * Package option card
 */
function PackageOption({ pkg }: { pkg: OfficialPackage }) {
  const { t } = useTranslation();
  const installCommand = getInstallCommand(pkg);

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {getPackageTypeLabel(pkg.registryType)}
          </Badge>
          {pkg.version && (
            <span className="text-xs text-muted-foreground font-mono">
              v{pkg.version}
            </span>
          )}
        </div>
        <Badge variant="outline" className="text-[10px]">
          {pkg.transport.type.toUpperCase()}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <code className="flex-1 text-sm bg-muted px-3 py-2 rounded font-mono overflow-x-auto">
          {installCommand}
        </code>
        <CopyButton text={installCommand} className="h-8 w-8 shrink-0" />
      </div>

      {/* Environment Variables */}
      {pkg.environmentVariables && pkg.environmentVariables.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {t('marketplace.envVars')}:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {pkg.environmentVariables.map((env) => (
              <Badge
                key={env.name}
                variant="outline"
                className="text-[10px] font-mono"
              >
                {env.name}
                {env.isRequired && (
                  <span className="text-red-500 ml-0.5">*</span>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface OfficialServerHeaderProps {
  server: OfficialServerDisplay;
}

export function OfficialServerHeader({ server }: OfficialServerHeaderProps) {
  const { t } = useTranslation();
  const packages = server._original?.server?.packages || [];
  const remotes = server._original?.server?.remotes || [];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/mcp?source=official"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('marketplace.backToMarketplace')}
      </Link>

      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            {/* Server Icon - using img for external URLs */}
            {server.iconUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={server.iconUrl}
                alt={server.name}
                className="h-16 w-16 rounded-xl bg-muted object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{server.name}</h1>
                <SourceBadge source="official" />
                {server.status === 'deprecated' && (
                  <Badge
                    variant="outline"
                    className="text-amber-500 border-amber-500/50"
                  >
                    {t('marketplace.deprecated')}
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-lg text-muted-foreground">
                {server.description || t('marketplace.noDescription')}
              </p>
            </div>
          </div>

          <Badge variant="secondary" className="text-sm">
            v{server.version}
          </Badge>
        </div>

        {/* Server ID */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">{t('marketplace.serverId')}:</span>
          <code className="bg-muted px-2 py-1 rounded font-mono text-xs">
            {server.id}
          </code>
          <CopyButton text={server.id} className="h-6 w-6" />
        </div>

        {/* Links */}
        <div className="flex items-center gap-2">
          {server.repositoryUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(server.repositoryUrl!, '_blank')}
            >
              <GitBranch className="h-4 w-4 mr-2" />
              {t('marketplace.repository')}
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
          )}
          {server.websiteUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(server.websiteUrl!, '_blank')}
            >
              <Globe className="h-4 w-4 mr-2" />
              {t('marketplace.website')}
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
          )}
        </div>
      </div>

      {/* Installation Options */}
      {packages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              {t('marketplace.installationOptions')} ({packages.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {packages.map((pkg, idx) => (
              <PackageOption
                key={`${pkg.registryType}-${pkg.identifier}-${idx}`}
                pkg={pkg}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Remote Endpoints */}
      {remotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t('marketplace.remoteEndpoints')} ({remotes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {remotes.map((remote, idx) => (
              <div key={idx} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {remote.type?.toUpperCase() || 'REMOTE'}
                  </Badge>
                </div>
                {remote.url && (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-muted px-3 py-2 rounded font-mono overflow-x-auto">
                      {remote.url}
                    </code>
                    <CopyButton text={remote.url} className="h-8 w-8 shrink-0" />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* No Installation Options */}
      {packages.length === 0 && remotes.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {t('marketplace.noInstallationOptions')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
