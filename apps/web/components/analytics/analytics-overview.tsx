import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Download, Heart, TrendingUp } from 'lucide-react';

interface AnalyticsOverviewProps {
  totalPackages: number;
  totalDownloads: number;
  totalFavorites: number;
}

export function AnalyticsOverview({
  totalPackages,
  totalDownloads,
  totalFavorites,
}: AnalyticsOverviewProps) {
  const stats = [
    {
      title: 'Total Packages',
      value: totalPackages,
      icon: Package,
      description: 'MCP servers and skills published',
    },
    {
      title: 'Total Downloads',
      value: totalDownloads.toLocaleString(),
      icon: Download,
      description: 'All-time downloads',
    },
    {
      title: 'Total Favorites',
      value: totalFavorites.toLocaleString(),
      icon: Heart,
      description: 'Users who favorited your packages',
    },
    {
      title: 'Avg per Package',
      value:
        totalPackages > 0
          ? Math.round(totalDownloads / totalPackages).toLocaleString()
          : '0',
      icon: TrendingUp,
      description: 'Average downloads per package',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
