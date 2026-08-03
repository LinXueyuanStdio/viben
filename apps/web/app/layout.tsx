import type { Metadata } from 'next';
import { Inter, Crimson_Pro } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { I18nProvider } from '@/components/providers/i18n-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { Toaster } from 'sonner';
import { Analytics } from "@vercel/analytics/react"
import { WebVitalsReporter } from "@/components/analytics/web-vitals"
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
  description:
    'Agent Swarm × Code Evolution - Multi-agent collaboration platform for controllable AI workflows',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    siteName: 'Viben',
    type: 'website',
    locale: 'zh_CN',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://avatars.githubusercontent.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.variable} ${crimsonPro.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider>
            <QueryProvider>
              {children}
            </QueryProvider>
            <Toaster />
          </I18nProvider>
        </ThemeProvider>
        <Analytics />
        <WebVitalsReporter />
      </body>
    </html>
  );
}
