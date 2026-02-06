import type { Metadata } from 'next';
import { Inter, Crimson_Pro } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { I18nProvider } from '@/components/providers/i18n-provider';
import { Toaster } from 'sonner';
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
          <I18nProvider>
            {children}
            <Toaster />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
