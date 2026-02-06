import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Package, Tag, Server, Globe, CheckCircle } from 'lucide-react';
import type { OfficialServerDisplay } from '@/lib/types/official-registry';
import { getPackageTypeLabel } from './official-server-card';

interface OfficialServerSidebarProps {
  server: OfficialServerDisplay;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function OfficialServerSidebar({ server }: OfficialServerSidebarProps) {
  const packages = server._original?.server?.packages || [];

  return (
    <div className="space-y-4">
      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              Status
            </span>
            <Badge
              variant={server.status === 'active' ? 'default' : 'secondary'}
              className={
                server.status === 'deprecated'
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                  : ''
              }
            >
              {server.status.charAt(0).toUpperCase() + server.status.slice(1)}
            </Badge>
          </div>

          {server.isLatest && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Tag className="h-4 w-4" />
                Latest
              </span>
              <Badge variant="outline" className="text-green-600 border-green-500/20">
                Yes
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              Version
            </span>
            <Badge variant="secondary">{server.version}</Badge>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Published
            </span>
            <span className="text-xs">{formatDate(server.publishedAt)}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Updated
            </span>
            <span className="text-xs">{formatDate(server.updatedAt)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Package Types */}
      {server.packageTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Available Packages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {server.packageTypes.map((type) => (
                <Badge key={type} variant="outline" className="text-xs">
                  {getPackageTypeLabel(type)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transports */}
      {packages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Transports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[...new Set(packages.map((pkg) => pkg.transport.type))].map(
                (transport) => (
                  <Badge key={transport} variant="outline" className="text-xs">
                    <Server className="h-3 w-3 mr-1" />
                    {transport.toUpperCase()}
                  </Badge>
                )
              )}
              {server.hasRemotes && (
                <Badge variant="outline" className="text-xs">
                  <Globe className="h-3 w-3 mr-1" />
                  REMOTE
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Repository */}
      {server.repositoryUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Repository</CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={server.repositoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline break-all"
            >
              {server.repositoryUrl.replace(/^https?:\/\//, '')}
            </a>
          </CardContent>
        </Card>
      )}

      {/* Website */}
      {server.websiteUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Website</CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={server.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline break-all"
            >
              {server.websiteUrl.replace(/^https?:\/\//, '')}
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
