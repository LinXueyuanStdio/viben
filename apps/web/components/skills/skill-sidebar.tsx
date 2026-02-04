import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Package, Tag, Zap } from 'lucide-react';

interface SkillSidebarProps {
  package: {
    id: string;
    slug: string;
    version: string;
    skillType: string;
    content: string;
    category: string | null;
    compatibility: string[] | null;
    dependencies: string[] | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

export function SkillSidebar({ package: pkg }: SkillSidebarProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Quick Start</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
            <code>/{pkg.slug}</code>
          </pre>
        </CardContent>
      </Card>

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
            <Badge variant="secondary">{pkg.version}</Badge>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Zap className="h-4 w-4" />
              Type
            </span>
            <Badge variant="outline">{pkg.skillType}</Badge>
          </div>

          {pkg.category && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Tag className="h-4 w-4" />
                Category
              </span>
              <span>{pkg.category}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Published
            </span>
            <span>{pkg.createdAt.toLocaleDateString()}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Updated
            </span>
            <span>{pkg.updatedAt.toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>

      {pkg.compatibility && pkg.compatibility.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Compatibility</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {pkg.compatibility.map((item) => (
                <Badge key={item} variant="outline">
                  {item}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {pkg.dependencies && pkg.dependencies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Dependencies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {pkg.dependencies.map((dep) => (
                <Badge key={dep} variant="outline">
                  {dep}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
