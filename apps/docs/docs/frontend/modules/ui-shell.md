---
sidebar_position: 2
title: UI Shell
description: "Application shell: layout, navigation, theming system"
---

# UI Shell

> Build the application shell, including layout, navigation, and theming system.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T3 |
| Dependencies | T0 (Project Setup) |
| Effort | 2 points |
| Priority | P0 |

---

## Objectives

1. Create dashboard layout with sidebar
2. Implement navigation components
3. Set up theming (dark/light mode)
4. Add loading states and error boundaries

---

## Deliverables

### 1. Layout Structure

```
app/
├── layout.tsx                    # Root layout (providers)
├── (auth)/
│   └── layout.tsx               # Auth layout (centered, no sidebar)
└── (dashboard)/
    └── layout.tsx               # Dashboard layout (with sidebar)
```

### 2. Root Layout (`apps/web/app/layout.tsx`)

```tsx
import type { Metadata } from 'next';
import { Inter, Crimson_Pro } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const crimsonPro = Crimson_Pro({
  subsets: ['latin'],
  variable: '--font-serif',
});

export const metadata: Metadata = {
  title: {
    default: 'Viben',
    template: '%s | Viben',
  },
  description: 'AI Tool Platform - MCP & Skills Marketplace',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${crimsonPro.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### 3. Dashboard Layout (`apps/web/app/(dashboard)/layout.tsx`)

```tsx
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 4. Sidebar Component (`apps/web/components/layout/sidebar.tsx`)

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Package,
  Sparkles,
  FolderKanban,
  Settings,
  User,
  Building2,
} from 'lucide-react';

const navigation = [
  { name: 'MCP Marketplace', href: '/mcp', icon: Package },
  { name: 'Skills', href: '/skills', icon: Sparkles },
  { name: 'Workspaces', href: '/workspaces', icon: FolderKanban },
  { name: 'Organizations', href: '/orgs', icon: Building2 },
];

const userNavigation = [
  { name: 'Profile', href: '/profile', icon: User },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r bg-background">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          <span className="font-serif text-xl font-semibold">Viben</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Navigation */}
      <div className="border-t p-4">
        {userNavigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
```

### 5. Header Component (`apps/web/components/layout/header.tsx`)

```tsx
import { getSession } from '@/lib/auth/cookies';
import { UserMenu } from '@/components/layout/user-menu';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export async function Header() {
  const session = await getSession();

  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div>
        {/* Breadcrumbs or search could go here */}
      </div>

      <div className="flex items-center gap-4">
        <ThemeToggle />
        {session ? (
          <UserMenu session={session} />
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Sign up</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
```

### 6. Theme Provider (`apps/web/components/providers/theme-provider.tsx`)

```tsx
'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes/dist/types';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

### 7. CSS Variables (`apps/web/app/globals.css`)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 20 14.3% 4.1%;
    --card: 0 0% 100%;
    --card-foreground: 20 14.3% 4.1%;
    --popover: 0 0% 100%;
    --popover-foreground: 20 14.3% 4.1%;
    --primary: 24 100% 50%;        /* Warm orange */
    --primary-foreground: 60 9.1% 97.8%;
    --secondary: 60 4.8% 95.9%;
    --secondary-foreground: 24 9.8% 10%;
    --muted: 60 4.8% 95.9%;
    --muted-foreground: 25 5.3% 44.7%;
    --accent: 60 4.8% 95.9%;
    --accent-foreground: 24 9.8% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 60 9.1% 97.8%;
    --border: 20 5.9% 90%;
    --input: 20 5.9% 90%;
    --ring: 24 100% 50%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 20 14.3% 4.1%;
    --foreground: 60 9.1% 97.8%;
    --card: 20 14.3% 4.1%;
    --card-foreground: 60 9.1% 97.8%;
    --popover: 20 14.3% 4.1%;
    --popover-foreground: 60 9.1% 97.8%;
    --primary: 24 100% 50%;
    --primary-foreground: 60 9.1% 97.8%;
    --secondary: 12 6.5% 15.1%;
    --secondary-foreground: 60 9.1% 97.8%;
    --muted: 12 6.5% 15.1%;
    --muted-foreground: 24 5.4% 63.9%;
    --accent: 12 6.5% 15.1%;
    --accent-foreground: 60 9.1% 97.8%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 60 9.1% 97.8%;
    --border: 12 6.5% 15.1%;
    --input: 12 6.5% 15.1%;
    --ring: 24 100% 50%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

---

## Required shadcn/ui Components

```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add dropdown-menu
pnpm dlx shadcn@latest add avatar
pnpm dlx shadcn@latest add sonner
```

---

## Acceptance Criteria

- [ ] Dashboard layout renders with sidebar
- [ ] Navigation highlights active route
- [ ] Theme toggle works (light/dark)
- [ ] Header shows user menu when logged in
- [ ] Header shows sign in/up buttons when logged out
- [ ] Responsive sidebar (collapsible on mobile)
- [ ] Fonts load correctly (Inter + Crimson Pro)

---

## Notes

- Use "Warm Futurism" design system from frontend spec
- Primary color is warm orange (#FF6B00)
- Sidebar should be collapsible on mobile
- Consider adding breadcrumbs to header later
