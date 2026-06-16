import "./globals.css";

export const metadata = {
  title: "Trading Terminal",
  description: "策略交易监控面板",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=new URLSearchParams(location.search).get('theme');if(t==='dark')document.documentElement.classList.add('dark');})();` }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
