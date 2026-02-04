import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Server, Zap, Download, Heart } from 'lucide-react';

interface Package {
  id: string;
  name: string;
  downloadsCount: number;
  favoritesCount: number;
}

interface TopPackagesProps {
  mcps: Package[];
  skills: Package[];
}

export function TopPackages({ mcps, skills }: TopPackagesProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-500" />
            Top MCP Servers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mcps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No MCP servers published yet
            </p>
          ) : (
            <div className="space-y-4">
              {mcps.map((pkg, index) => (
                <div key={pkg.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">
                      #{index + 1}
                    </span>
                    <Link
                      href={`/mcp/${pkg.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {pkg.name}
                    </Link>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {pkg.downloadsCount.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {pkg.favoritesCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Top Skills
          </CardTitle>
        </CardHeader>
        <CardContent>
          {skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No skills published yet
            </p>
          ) : (
            <div className="space-y-4">
              {skills.map((pkg, index) => (
                <div key={pkg.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">
                      #{index + 1}
                    </span>
                    <Link
                      href={`/skills/${pkg.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {pkg.name}
                    </Link>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {pkg.downloadsCount.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {pkg.favoritesCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
