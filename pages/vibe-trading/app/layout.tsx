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
        <link rel="stylesheet" href="/api/page/_sdk/v1/viben-page-tokens.css" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <script src="/api/page/_sdk/v1/viben-page-sdk.js" async />
        <script dangerouslySetInnerHTML={{ __html: `
(function(){
  console.log('[vibe-trading] theme init script running');
  console.log('[vibe-trading] window.VibenPage:', window.VibenPage);
  console.log('[vibe-trading] window.__VIBEN_CONFIG__:', JSON.stringify(window.__VIBEN_CONFIG__ || null));
  console.log('[vibe-trading] window.parent === window:', window.parent === window);
  console.log('[vibe-trading] location.href:', location.href);

  function bind(viben){
    console.log('[vibe-trading] bind() called');
    console.log('[vibe-trading] viben.state:', viben.state);
    console.log('[vibe-trading] viben.theme:', viben.theme);
    console.log('[vibe-trading] viben.clientId:', viben.clientId);
    if(viben.theme==='dark'){
      console.log('[vibe-trading] applying dark theme');
      document.documentElement.classList.add('dark');
    }
    viben.onThemeChange(function(t){
      console.log('[vibe-trading] onThemeChange fired:', t);
      document.documentElement.classList.toggle('dark',t==='dark');
    });
  }

  var v=window.VibenPage;
  if(v&&v.state==='connected'){
    console.log('[vibe-trading] VibenPage already connected');
    bind(v);
  } else if(v){
    console.log('[vibe-trading] VibenPage exists but state:', v.state, '- waiting for ready');
    v.ready.then(function(){
      console.log('[vibe-trading] viben.ready resolved');
      bind(v);
    }).catch(function(err){
      console.error('[vibe-trading] viben.ready rejected:', err);
    });
  } else {
    console.log('[vibe-trading] VibenPage not loaded yet, listening for viben:connected event');
    window.addEventListener('viben:connected',function(e){
      console.log('[vibe-trading] viben:connected event received');
      bind(e.detail);
    },{once:true});
  }
})();
`}} />
      </body>
    </html>
  );
}
