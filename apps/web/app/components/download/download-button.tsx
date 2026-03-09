'use client';

import { useState, useEffect } from 'react';
import { Download, ChevronDown, Apple, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useReleaseData, detectPlatform } from './use-release-data';
import type { Platform, DesktopRelease } from './types';

// Linux icon component (Lucide doesn't have a Linux icon)
function LinuxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.4v.019c.002.089.008.179.02.267-.193-.067-.438-.135-.607-.202a1.635 1.635 0 01-.018-.2v-.02a1.772 1.772 0 01.15-.768c.082-.22.232-.406.43-.533a.985.985 0 01.594-.2zm-2.962.059h.036c.142 0 .27.048.399.135.146.129.264.288.344.465.09.199.14.4.153.667v.004c.007.134.006.2-.002.266v.08c-.03.007-.056.018-.083.024-.152.055-.274.135-.393.2.012-.09.013-.18.003-.267v-.015c-.012-.133-.04-.2-.082-.333a.613.613 0 00-.166-.267.248.248 0 00-.183-.064h-.021c-.071.006-.13.04-.186.132a.552.552 0 00-.12.27.944.944 0 00-.023.33v.015c.012.135.037.2.08.334.046.134.098.2.166.268.01.009.02.018.034.024-.07.057-.117.07-.176.136a.304.304 0 01-.131.068 2.62 2.62 0 01-.275-.402 1.772 1.772 0 01-.155-.667 1.759 1.759 0 01.08-.668 1.43 1.43 0 01.283-.535c.128-.133.26-.2.418-.2zm1.37 1.706c.332 0 .733.065 1.216.399.293.2.523.269 1.052.468h.003c.255.136.405.266.478.399v-.131a.571.571 0 01.016.47c-.123.31-.516.643-1.063.842v.002c-.268.135-.501.333-.775.465-.276.135-.588.292-1.012.267a1.139 1.139 0 01-.448-.067 3.566 3.566 0 01-.322-.198c-.195-.135-.363-.332-.612-.465v-.005h-.005c-.4-.246-.616-.512-.686-.71-.07-.268-.005-.47.193-.6.224-.135.38-.271.483-.336.104-.074.143-.102.176-.131h.002v-.003c.169-.202.436-.47.839-.601.139-.036.294-.065.466-.065zm2.8 2.142c.358 1.417 1.196 3.475 1.735 4.473.286.534.855 1.659 1.102 3.024.156-.005.33.018.513.064.646-1.671-.546-3.467-1.089-3.966-.22-.2-.232-.335-.123-.335.59.534 1.365 1.572 1.646 2.757.13.535.16 1.104.021 1.67.067.028.135.06.205.067 1.032.534 1.413.938 1.23 1.537v-.043c-.06-.003-.12 0-.18 0h-.016c.151-.467-.182-.825-1.065-1.224-.915-.4-1.646-.336-1.77.465-.008.043-.013.066-.018.135-.068.023-.139.053-.209.064-.43.268-.662.669-.793 1.187-.13.533-.17 1.156-.205 1.869v.003c-.02.482-.04.965-.07 1.39a.96.96 0 01-.152.43c-.177-.405-.324-.601-.543-.79-.146-.127-.297-.198-.448-.338-.3-.268-.533-.602-.676-1.005-.143-.404-.19-.867-.126-1.367l.003-.02v-.004l.003-.02c.043-.199.086-.4.13-.601.085-.399.175-.8.268-1.101.04-.135.08-.2.12-.333h-.006c.057-.138.122-.266.194-.399v-.004c.106-.199.2-.332.28-.464.037-.066.063-.066.094-.133a.386.386 0 00.047-.266c-.029-.133-.108-.267-.107-.4.003-.2.096-.399.236-.533.14-.134.31-.2.494-.2.18 0 .351.066.478.2.128.132.202.265.206.398 0 .135-.055.268-.122.4a.418.418 0 00-.036.267c.006.066.025.133.063.2l.094.132c.079.134.158.267.252.4.147.201.283.399.413.598.13.2.251.4.375.6.063.1.122.2.178.333.022-.135.03-.266.03-.398v-.466l.003-.067-.003-.2v-.067l-.003-.2-.006-.2-.003-.133v-.066l-.009-.135-.006-.133-.009-.2-.012-.133-.018-.267-.024-.2-.024-.2v-.005l-.027-.2v-.003l-.024-.134c-.082-.4-.18-.798-.277-1.2-.052-.197-.107-.399-.165-.6l-.022-.066a9.788 9.788 0 00-.108-.4l-.054-.133c-.058-.2-.122-.4-.195-.6l-.066-.133c-.054-.133-.11-.265-.168-.399l-.048-.066a.21.21 0 00-.042-.067l-.024-.066a1.42 1.42 0 00-.036-.067l-.048-.066-.036-.067-.024-.066a.605.605 0 00-.048-.135l-.096-.2c.073-.2.157-.334.246-.4.09-.067.19-.067.3 0 .005-.067.01-.133.018-.2-.016 0-.033-.003-.05-.003zm-2.066 2.07c.003 0 .01 0 .017.002a.136.136 0 01.108.067c.016.026.02.059.008.089-.19.46-.404.867-.63 1.206-.059.088-.118.17-.178.255-.146.202-.27.398-.417.6-.18.218-.352.424-.534.601v.001c-.22.197-.458.395-.73.527a1.482 1.482 0 01-.486.134c.073-.267.175-.534.289-.8.11-.267.236-.534.378-.8.073-.134.15-.267.228-.4.08-.134.162-.267.246-.401.085-.133.17-.266.258-.398.087-.134.182-.269.276-.403.093-.133.189-.266.287-.399.098-.132.2-.264.303-.398l.042-.067c.01-.011.025-.025.042-.025h.006c.002 0 .005-.002.008-.002l.019-.002zm-3.753.893c-.093 0-.186.004-.276.016a1.08 1.08 0 00-.489.136c-.16.097-.3.23-.415.385a2.51 2.51 0 00-.294.534c-.086.199-.145.398-.18.6a1.745 1.745 0 00.074 1.002c.1.266.25.53.426.728.177.2.37.334.562.397.194.067.382.067.554 0 .172-.066.33-.197.465-.395.135-.2.243-.465.323-.798.08-.334.13-.735.143-1.203 0-.266-.01-.535-.065-.802a2.15 2.15 0 00-.233-.667 1.142 1.142 0 00-.428-.464 1.04 1.04 0 00-.587-.17z"/>
    </svg>
  );
}

interface DownloadOption {
  platform: Platform;
  label: string;
  icon: typeof Apple | typeof Monitor | typeof LinuxIcon;
  getUrl: (release: DesktopRelease) => string;
  getFilename: (release: DesktopRelease) => string;
}

const DOWNLOAD_OPTIONS: DownloadOption[] = [
  {
    platform: 'macos',
    label: 'macOS (Universal)',
    icon: Apple,
    getUrl: (r) => r.assets.macos.dmg.url,
    getFilename: (r) => r.assets.macos.dmg.name,
  },
  {
    platform: 'windows',
    label: 'Windows (64-bit)',
    icon: Monitor,
    getUrl: (r) => r.assets.windows.msi.url || r.assets.windows.exe.url,
    getFilename: (r) => r.assets.windows.msi.name || r.assets.windows.exe.name,
  },
  {
    platform: 'linux',
    label: 'Linux (AppImage)',
    icon: LinuxIcon,
    getUrl: (r) => r.assets.linux.appimage.url,
    getFilename: (r) => r.assets.linux.appimage.name,
  },
];

interface DownloadButtonProps {
  className?: string;
}

export function DownloadButton({ className }: DownloadButtonProps) {
  const { t } = useTranslation();
  const { desktop, loading } = useReleaseData();
  const [currentPlatform, setCurrentPlatform] = useState<Platform>('unknown');

  useEffect(() => {
    setCurrentPlatform(detectPlatform());
  }, []);

  // Find the best download option for current platform
  const primaryOption = DOWNLOAD_OPTIONS.find((o) => o.platform === currentPlatform) || DOWNLOAD_OPTIONS[0];

  const handleDownload = (option: DownloadOption) => {
    if (!desktop) return;
    const url = option.getUrl(desktop);
    if (url) {
      window.open(url, '_blank');
    }
  };

  // If no release data, show a link to GitHub releases
  if (!desktop && !loading) {
    return (
      <a
        href={`https://github.com/${DOWNLOAD_OPTIONS[0].platform === 'unknown' ? 'LinXueyuanStdio/viben' : 'LinXueyuanStdio/viben'}/releases`}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/10 ${className}`}
      >
        <Download className="h-4 w-4" />
        {t('homepage.download.downloadDesktop')}
      </a>
    );
  }

  const PrimaryIcon = primaryOption.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-300/50 ${className}`}
          disabled={loading}
        >
          {loading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-zinc-200" />
              {t('homepage.download.loading')}
            </>
          ) : (
            <>
              <PrimaryIcon className="h-4 w-4" />
              {t('homepage.download.downloadDesktop')}
              <ChevronDown className="ml-1 h-4 w-4" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        className="w-56 border-zinc-800 bg-zinc-900 text-zinc-100"
      >
        <DropdownMenuLabel className="text-xs text-zinc-400">
          Viben Desktop {desktop?.version && `v${desktop.version}`}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-zinc-800" />
        {DOWNLOAD_OPTIONS.map((option) => {
          const Icon = option.icon;
          const url = desktop ? option.getUrl(desktop) : '';
          const isAvailable = !!url;

          return (
            <DropdownMenuItem
              key={option.platform}
              onClick={() => handleDownload(option)}
              disabled={!isAvailable}
              className={`flex cursor-pointer items-center gap-2 text-sm transition-colors hover:bg-zinc-800 focus:bg-zinc-800 ${
                option.platform === currentPlatform ? 'bg-zinc-800/50' : ''
              } ${!isAvailable ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <Icon className="h-4 w-4" />
              <span>{option.label}</span>
              {option.platform === currentPlatform && (
                <span className="ml-auto rounded bg-amber-300/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                  {t('homepage.download.recommended')}
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator className="bg-zinc-800" />
        <DropdownMenuItem asChild>
          <a
            href="https://github.com/LinXueyuanStdio/viben/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 focus:bg-zinc-800"
          >
            {t('homepage.download.viewAllVersions')}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
