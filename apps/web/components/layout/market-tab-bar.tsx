'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Sparkles } from 'lucide-react';

const MARKET_TABS = [
  { key: 'mcp', label: 'MCP', href: '/mcp-market', icon: Package },
  { key: 'skill', label: '技能', href: '/skill-market', icon: Sparkles },
] as const;

function resolveActiveTab(pathname: string): string {
  if (pathname.startsWith('/mcp-market')) return 'mcp';
  if (pathname.startsWith('/skill-market')) return 'skill';
  return 'mcp';
}

export function MarketTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = resolveActiveTab(pathname);

  const handleTabChange = (value: string) => {
    const tab = MARKET_TABS.find((t) => t.key === value);
    if (!tab) return;
    router.push(tab.href);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        {MARKET_TABS.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key}>
            <tab.icon className="mr-1.5 h-4 w-4" />
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
