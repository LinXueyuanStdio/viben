'use client';

import { useState } from 'react';
import { Apple, Monitor, Terminal, Package, Copy, Check, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useReleaseData } from './use-release-data';

// Linux icon component
function LinuxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.4v.019c.002.089.008.179.02.267-.193-.067-.438-.135-.607-.202a1.635 1.635 0 01-.018-.2v-.02a1.772 1.772 0 01.15-.768c.082-.22.232-.406.43-.533a.985.985 0 01.594-.2zm-2.962.059h.036c.142 0 .27.048.399.135.146.129.264.288.344.465.09.199.14.4.153.667v.004c.007.134.006.2-.002.266v.08c-.03.007-.056.018-.083.024-.152.055-.274.135-.393.2.012-.09.013-.18.003-.267v-.015c-.012-.133-.04-.2-.082-.333a.613.613 0 00-.166-.267.248.248 0 00-.183-.064h-.021c-.071.006-.13.04-.186.132a.552.552 0 00-.12.27.944.944 0 00-.023.33v.015c.012.135.037.2.08.334.046.134.098.2.166.268.01.009.02.018.034.024-.07.057-.117.07-.176.136a.304.304 0 01-.131.068 2.62 2.62 0 01-.275-.402 1.772 1.772 0 01-.155-.667 1.759 1.759 0 01.08-.668 1.43 1.43 0 01.283-.535c.128-.133.26-.2.418-.2zm1.37 1.706c.332 0 .733.065 1.216.399.293.2.523.269 1.052.468h.003c.255.136.405.266.478.399v-.131a.571.571 0 01.016.47c-.123.31-.516.643-1.063.842v.002c-.268.135-.501.333-.775.465-.276.135-.588.292-1.012.267a1.139 1.139 0 01-.448-.067 3.566 3.566 0 01-.322-.198c-.195-.135-.363-.332-.612-.465v-.005h-.005c-.4-.246-.616-.512-.686-.71-.07-.268-.005-.47.193-.6.224-.135.38-.271.483-.336.104-.074.143-.102.176-.131h.002v-.003c.169-.202.436-.47.839-.601.139-.036.294-.065.466-.065zm2.8 2.142c.358 1.417 1.196 3.475 1.735 4.473.286.534.855 1.659 1.102 3.024.156-.005.33.018.513.064.646-1.671-.546-3.467-1.089-3.966-.22-.2-.232-.335-.123-.335.59.534 1.365 1.572 1.646 2.757.13.535.16 1.104.021 1.67.067.028.135.06.205.067 1.032.534 1.413.938 1.23 1.537v-.043c-.06-.003-.12 0-.18 0h-.016c.151-.467-.182-.825-1.065-1.224-.915-.4-1.646-.336-1.77.465-.008.043-.013.066-.018.135-.068.023-.139.053-.209.064-.43.268-.662.669-.793 1.187-.13.533-.17 1.156-.205 1.869v.003c-.02.482-.04.965-.07 1.39a.96.96 0 01-.152.43c-.177-.405-.324-.601-.543-.79-.146-.127-.297-.198-.448-.338-.3-.268-.533-.602-.676-1.005-.143-.404-.19-.867-.126-1.367l.003-.02v-.004l.003-.02c.043-.199.086-.4.13-.601.085-.399.175-.8.268-1.101.04-.135.08-.2.12-.333h-.006c.057-.138.122-.266.194-.399v-.004c.106-.199.2-.332.28-.464.037-.066.063-.066.094-.133a.386.386 0 00.047-.266c-.029-.133-.108-.267-.107-.4.003-.2.096-.399.236-.533.14-.134.31-.2.494-.2.18 0 .351.066.478.2.128.132.202.265.206.398 0 .135-.055.268-.122.4a.418.418 0 00-.036.267c.006.066.025.133.063.2l.094.132c.079.134.158.267.252.4.147.201.283.399.413.598.13.2.251.4.375.6.063.1.122.2.178.333.022-.135.03-.266.03-.398v-.466l.003-.067-.003-.2v-.067l-.003-.2-.006-.2-.003-.133v-.066l-.009-.135-.006-.133-.009-.2-.012-.133-.018-.267-.024-.2-.024-.2v-.005l-.027-.2v-.003l-.024-.134c-.082-.4-.18-.798-.277-1.2-.052-.197-.107-.399-.165-.6l-.022-.066a9.788 9.788 0 00-.108-.4l-.054-.133c-.058-.2-.122-.4-.195-.6l-.066-.133c-.054-.133-.11-.265-.168-.399l-.048-.066a.21.21 0 00-.042-.067l-.024-.066a1.42 1.42 0 00-.036-.067l-.048-.066-.036-.067-.024-.066a.605.605 0 00-.048-.135l-.096-.2c.073-.2.157-.334.246-.4.09-.067.19-.067.3 0 .005-.067.01-.133.018-.2-.016 0-.033-.003-.05-.003zm-2.066 2.07c.003 0 .01 0 .017.002a.136.136 0 01.108.067c.016.026.02.059.008.089-.19.46-.404.867-.63 1.206-.059.088-.118.17-.178.255-.146.202-.27.398-.417.6-.18.218-.352.424-.534.601v.001c-.22.197-.458.395-.73.527a1.482 1.482 0 01-.486.134c.073-.267.175-.534.289-.8.11-.267.236-.534.378-.8.073-.134.15-.267.228-.4.08-.134.162-.267.246-.401.085-.133.17-.266.258-.398.087-.134.182-.269.276-.403.093-.133.189-.266.287-.399.098-.132.2-.264.303-.398l.042-.067c.01-.011.025-.025.042-.025h.006c.002 0 .005-.002.008-.002l.019-.002zm-3.753.893c-.093 0-.186.004-.276.016a1.08 1.08 0 00-.489.136c-.16.097-.3.23-.415.385a2.51 2.51 0 00-.294.534c-.086.199-.145.398-.18.6a1.745 1.745 0 00.074 1.002c.1.266.25.53.426.728.177.2.37.334.562.397.194.067.382.067.554 0 .172-.066.33-.197.465-.395.135-.2.243-.465.323-.798.08-.334.13-.735.143-1.203 0-.266-.01-.535-.065-.802a2.15 2.15 0 00-.233-.667 1.142 1.142 0 00-.428-.464 1.04 1.04 0 00-.587-.17z"/>
    </svg>
  );
}

interface CopyButtonProps {
  text: string;
}

function CopyButton({ text }: CopyButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
      title={t('homepage.download.copyCommand')}
    >
      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

interface DownloadCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  downloads: { label: string; url: string }[];
  version?: string;
}

function DownloadCard({ icon, title, description, downloads, version }: DownloadCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-amber-300/30 hover:bg-white/[0.05]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-300/10 text-amber-300">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          {version && <span className="text-xs text-zinc-500">v{version}</span>}
        </div>
      </div>
      <p className="mb-4 text-sm text-zinc-400">{description}</p>
      <div className="flex flex-wrap gap-2">
        {downloads.map((dl, idx) => (
          <a
            key={idx}
            href={dl.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/30 bg-amber-300/5 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-300/10"
          >
            {dl.label}
            <ExternalLink className="h-3 w-3" />
          </a>
        ))}
      </div>
    </div>
  );
}

interface InstallMethodProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  command: string;
  platforms: string[];
}

function InstallMethod({ icon, title, description, command, platforms }: InstallMethodProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
          {icon}
        </div>
        <div>
          <h4 className="font-medium text-white">{title}</h4>
          <p className="text-xs text-zinc-500">{platforms.join(' / ')}</p>
        </div>
      </div>
      <p className="mb-3 text-sm text-zinc-400">{description}</p>
      <div className="relative rounded-lg bg-zinc-900 p-3 pr-10">
        <code className="block overflow-x-auto whitespace-pre text-xs text-zinc-300">{command}</code>
        <CopyButton text={command} />
      </div>
    </div>
  );
}

export function DownloadSection() {
  const { t } = useTranslation();
  const { desktop, cli, loading } = useReleaseData();

  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <p className="mb-4 inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-300">
            {t('homepage.download.badge')}
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('homepage.download.title')}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-zinc-300">
            {t('homepage.download.description')}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-amber-300" />
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Desktop Downloads */}
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                <Monitor className="h-5 w-5 text-amber-300" />
                {t('homepage.download.desktopApp')}
              </h3>
              <div className="space-y-4">
                <DownloadCard
                  icon={<Apple className="h-5 w-5" />}
                  title="macOS"
                  description={t('homepage.download.macosDesc')}
                  downloads={[
                    ...(desktop?.assets.macos.arm64.url
                      ? [{ label: 'Apple Silicon (M1/M2/M3)', url: desktop.assets.macos.arm64.url }]
                      : []),
                    ...(desktop?.assets.macos.x64.url
                      ? [{ label: 'Intel', url: desktop.assets.macos.x64.url }]
                      : []),
                  ]}
                  version={desktop?.version}
                />
                <DownloadCard
                  icon={<Monitor className="h-5 w-5" />}
                  title="Windows"
                  description={t('homepage.download.windowsDesc')}
                  downloads={[
                    ...(desktop?.assets.windows.msi.url
                      ? [{ label: '.msi', url: desktop.assets.windows.msi.url }]
                      : []),
                    ...(desktop?.assets.windows.exe.url
                      ? [{ label: '.exe', url: desktop.assets.windows.exe.url }]
                      : []),
                  ]}
                  version={desktop?.version}
                />
                <DownloadCard
                  icon={<LinuxIcon className="h-5 w-5" />}
                  title="Linux"
                  description={t('homepage.download.linuxDesc')}
                  downloads={[
                    ...(desktop?.assets.linux.appimage.url
                      ? [{ label: '.AppImage', url: desktop.assets.linux.appimage.url }]
                      : []),
                    ...(desktop?.assets.linux.deb.url
                      ? [{ label: '.deb', url: desktop.assets.linux.deb.url }]
                      : []),
                  ]}
                  version={desktop?.version}
                />
              </div>
            </div>

            {/* CLI Installation */}
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                <Terminal className="h-5 w-5 text-amber-300" />
                {t('homepage.download.cliTools')}
                {cli?.version && <span className="text-xs font-normal text-zinc-500">v{cli.version}</span>}
              </h3>
              <div className="space-y-4">
                <InstallMethod
                  icon={<Terminal className="h-4 w-4" />}
                  title="Shell Script"
                  description={t('homepage.download.shellDesc')}
                  command={cli?.install_methods.shell.command || 'curl -fsSL https://github.com/LinXueyuanStdio/viben/releases/latest/download/install.sh | bash'}
                  platforms={['macOS', 'Linux']}
                />
                <InstallMethod
                  icon={<Package className="h-4 w-4" />}
                  title="npm / npx"
                  description={t('homepage.download.npmDesc')}
                  command={cli?.install_methods.npm.command || 'npm install -g viben'}
                  platforms={['macOS', 'Linux', 'Windows']}
                />
                <InstallMethod
                  icon={
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M5.514 22.5c-1.023 0-2.042-.376-2.823-1.107a3.873 3.873 0 01-.278-5.26L6.79 11.1a2.417 2.417 0 00.593-1.575v-3.27a2.417 2.417 0 00-.593-1.575L3.413 1.5h2.814l2.795 2.79c.42.405.66.965.66 1.55v3.81c0 .585-.24 1.145-.66 1.55l-3.495 3.495a1.937 1.937 0 00.139 2.63 1.935 1.935 0 002.63.14l3.495-3.496c.405-.42.965-.66 1.55-.66h3.81c.585 0 1.145.24 1.55.66l2.79 2.795v2.814l-3.18-3.377a2.417 2.417 0 00-1.575-.593h-3.27a2.417 2.417 0 00-1.575.593l-4.034 4.377a3.873 3.873 0 01-2.663 1.022zM20.587 1.5h-2.814l-2.795 2.79a2.18 2.18 0 01-1.55.66h-3.81a2.18 2.18 0 01-1.55-.66L5.273 1.5H2.46l3.18 3.377c.405.42.965.66 1.55.66h3.81c.585 0 1.145-.24 1.55-.66L16.928 1.5h2.814zm-.78 7.5h2.693v6.473a2.417 2.417 0 01-.593 1.575l-4.377 4.034a3.873 3.873 0 01-5.26-.278 3.873 3.873 0 01.278-5.26l4.034-4.377c.42-.405 1.02-.593 1.575-.593h1.575v-.045l.075-.045V9zm-1.65 2.449h-.045a.484.484 0 00-.315.128l-3.495 3.495a1.937 1.937 0 00.139 2.63c.72.72 1.91.72 2.63 0l3.495-3.495a.484.484 0 00.128-.315v-2.443h-2.537z"/>
                    </svg>
                  }
                  title="Homebrew"
                  description={t('homepage.download.homebrewDesc')}
                  command={cli?.install_methods.homebrew.command || 'brew tap LinXueyuanStdio/viben && brew install viben'}
                  platforms={['macOS', 'Linux']}
                />
              </div>
            </div>
          </div>
        )}

        {/* Fallback link */}
        <div className="mt-8 text-center">
          <a
            href="https://github.com/LinXueyuanStdio/viben/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-amber-300"
          >
            {t('homepage.download.viewAllReleases')}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
